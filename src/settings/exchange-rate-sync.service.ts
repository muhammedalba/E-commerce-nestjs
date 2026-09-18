import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { lastValueFrom } from 'rxjs';
import { Setting, SettingDocument } from './shared/schema/setting.schema';
import { SettingsService } from './settings.service';
import { Role, RoleDocument } from 'src/roles/shared/schemas/role.schema';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';

const OPEN_ER_API_URL =
  process.env.OPEN_ER_API_URL || 'https://open.er-api.com/v6/latest/USD';
const REQUEST_TIMEOUT_MS = parseInt(
  process.env.REQUEST_TIMEOUT_MS || '8000',
  10,
);
/** Skip a re-sync if the same currency was already synced more recently than this. */
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;
/** Alert admins once the sync has failed this many times in a row. */
const FAILURE_NOTIFY_THRESHOLD = parseInt(
  process.env.FAILURE_NOTIFY_THRESHOLD || '3',
  10,
);

interface OpenErApiResponse {
  result: string;
  rates: Record<string, number>;
}

/**
 * Keeps `Setting.exchangeRate` in sync with a real-world USD exchange rate.
 *
 * Fetches rates (base = USD) from open.er-api.com — once on application
 * startup and every hour after that — and stores the rate for the store's
 * configured `currencyCode`. `CronExpression.EVERY_HOUR` only fires at the
 * top of each hour, so the startup sync is what makes a freshly deployed or
 * restarted server show a real rate immediately instead of waiting for the
 * next hour boundary. On any failure (network, missing currency, malformed
 * response) the previously stored rate is left untouched so pricing never
 * breaks due to a transient outage.
 *
 * Startup, the hourly cron and a currency change (awaited directly by
 * `SettingsService.updateSettings`) can all trigger this close together; an
 * in-flight guard prevents overlapping calls, and a short cooldown skips
 * re-fetching the same currency's rate too soon.
 */
@Injectable()
export class ExchangeRateSyncService implements OnModuleInit {
  private readonly logger = new Logger(ExchangeRateSyncService.name);
  private isSyncing = false;
  private lastSync: { currencyCode: string; at: number } | null = null;
  private consecutiveFailures = 0;
  private hasNotifiedForCurrentIncident = false;

  constructor(
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => SettingsService))
    private readonly settingsService: SettingsService,
    @InjectModel(Setting.name)
    private readonly settingModel: Model<SettingDocument>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    @InjectQueue('mail-queue')
    private readonly mailQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.syncExchangeRate();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncExchangeRate(): Promise<void> {
    // Serialize calls: startup, the hourly cron and a currency-change event
    // can all land close together, and this stops them overlapping.
    if (this.isSyncing) {
      this.logger.debug('Exchange rate sync already in progress, skipping.');
      return;
    }

    const settings = await this.settingsService.getSettings();
    const currencyCode = (settings.currencyCode || 'SAR').toUpperCase();

    if (
      this.lastSync &&
      this.lastSync.currencyCode === currencyCode &&
      Date.now() - this.lastSync.at < MIN_SYNC_INTERVAL_MS
    ) {
      this.logger.debug(
        `Exchange rate for ${currencyCode} was synced recently, skipping duplicate request.`,
      );
      return;
    }

    this.isSyncing = true;
    try {
      if (currencyCode === 'USD') {
        await this.applyRate(1, currencyCode);
        return;
      }

      const response = await lastValueFrom(
        this.httpService.get<OpenErApiResponse>(OPEN_ER_API_URL, {
          timeout: REQUEST_TIMEOUT_MS,
        }),
      );
      const { result, rates } = response.data;
      const rate = rates?.[currencyCode];

      if (result !== 'success' || !rate || rate <= 0) {
        const reason = `no valid rate for ${currencyCode}`;
        this.logger.warn(
          `Exchange rate sync skipped: ${reason}. Keeping previous value.`,
        );
        await this.recordFailure(reason, currencyCode);
        return;
      }

      await this.applyRate(rate, currencyCode);
      this.logger.log(`Exchange rate synced: 1 USD = ${rate} ${currencyCode}`);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(
        `Exchange rate sync failed, keeping previous value: ${error.message}`,
      );
      await this.recordFailure(error.message, currencyCode);
    } finally {
      this.isSyncing = false;
    }
  }

  private async applyRate(
    exchangeRate: number,
    currencyCode: string,
  ): Promise<void> {
    // Round to 3 decimal places — plenty of precision for display purposes
    // (e.g. 48.731403 -> 48.731) without storing noise from the API response.
    const roundedRate = Math.round(exchangeRate * 1000) / 1000;

    await this.settingModel.findOneAndUpdate(
      { key: 'global' },
      {
        $set: { exchangeRate: roundedRate, exchangeRateUpdatedAt: new Date() },
      },
    );
    await this.settingsService.clearCache();
    this.lastSync = { currencyCode, at: Date.now() };
    this.consecutiveFailures = 0;
    this.hasNotifiedForCurrentIncident = false;
  }

  /**
   * Tracks consecutive failures and, once they cross the threshold, alerts
   * admins exactly once per incident (silenced again on the next success).
   * The notification is queued on `mail-queue` instead of written directly,
   * so it never adds latency to `SettingsService.updateSettings`, which now
   * awaits `syncExchangeRate()` inline on a currency change.
   */
  private async recordFailure(
    reason: string,
    currencyCode: string,
  ): Promise<void> {
    this.consecutiveFailures += 1;
    if (
      this.consecutiveFailures < FAILURE_NOTIFY_THRESHOLD ||
      this.hasNotifiedForCurrentIncident
    ) {
      return;
    }
    console.log(this.consecutiveFailures, 'consecutiveFailures');

    this.hasNotifiedForCurrentIncident = true;
    try {
      const adminRoles = await this.roleModel
        .find({ permissions: { $in: [Permissions.UPDATE_SETTINGS] } })
        .select('_id')
        .lean();

      await Promise.all([
        ...adminRoles.map((role) =>
          this.mailQueue.add('admin-role-notification', {
            roleId: role._id.toString(),
            action: 'EXCHANGE_RATE_SYNC_FAILED',
            message: {
              ar: `فشلت مزامنة سعر الصرف ${this.consecutiveFailures} مرات متتالية (${reason}). السعر المعروض حاليًا قد يكون قديمًا.`,
              en: `Exchange rate sync has failed ${this.consecutiveFailures} times in a row (${reason}). The displayed rate may be stale.`,
            },
            payload: { consecutiveFailures: this.consecutiveFailures, reason },
          }),
        ),
        this.mailQueue.add('exchange-rate-sync-failed', {
          email: process.env.ADMIN_EMAIL,
          adminName: 'Admin',
          currencyCode,
          consecutiveFailures: this.consecutiveFailures,
          reason,
          subject:
            'تنبيه: فشل مزامنة سعر الصرف / Exchange Rate Sync Failed Alert',
          lang: 'ar',
        }),
      ]);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Failed to queue exchange-rate-sync failure alert: ${error.message}`,
      );
    }
  }
}
