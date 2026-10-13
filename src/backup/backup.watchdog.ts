import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { Connection, Model } from 'mongoose';
import { REDIS_CLIENT, redisNamespace } from 'src/shared/redis/redis.module';
import { readdir, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { BackupAlerts } from './backup-alerts';
import { BackupChecksService } from './backup-checks.service';
import { BackupConfig } from './backup.config';
import { BackupScheduler } from './backup.scheduler';
import { BackupSettingsStore } from './backup-settings.store';
import {
  BACKUP_QUEUE,
  BACKUP_SCHEDULER_ID,
  BackupSettings,
  SPOOL_DIR_NAME,
  UPLOAD_TEMP_DIR_NAME,
  buildCronPattern,
  sanitizeError,
} from './backup.types';
import { markLiveDatabase } from './live-marker';
import { BackupRun, BackupRunDocument } from './schemas/backup-run.schema';

const HOUR_MS = 60 * 60 * 1000;
/** Allowance on top of two missed intervals (slow runs, retries, restarts). */
const STALE_GRACE_MS = HOUR_MS;
/** At most one stale alert per this period, across all instances. */
const STALE_ALERT_EVERY_MS = 12 * HOUR_MS;
/** A check still queued/running after this was interrupted. */
const STALE_CHECK_MS = 12 * HOUR_MS;
/** Temp files older than this belong to no running operation. */
const TEMP_FILE_MAX_AGE_MS = 6 * HOUR_MS;

export type WatchdogResult =
  | { state: 'inactive' }
  | { state: 'ok'; schedulerRestored: boolean }
  | {
      state: 'stale';
      since: Date;
      alerted: boolean;
      schedulerRestored: boolean;
    };

/**
 * Catches backups that stop silently — failures alert on their own, but a
 * missing schedule does not fail anything:
 * - the BullMQ job scheduler can vanish with Redis data (restart without
 *   persistence, eviction, a new Redis) and was only re-applied at startup;
 * - every 30 minutes this re-applies it if it is missing, and alerts when the
 *   last successful backup is older than two schedule intervals (+1 h).
 * Also (re)marks the live database (see live-marker.ts).
 */
@Injectable()
export class BackupWatchdog implements OnApplicationBootstrap {
  private readonly logger = new Logger(BackupWatchdog.name);
  private readonly ns: string;
  /** Fallback de-duplication when Redis is not available. */
  private lastAlertAt = 0;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: BackupConfig,
    private readonly store: BackupSettingsStore,
    private readonly scheduler: BackupScheduler,
    private readonly alerts: BackupAlerts,
    private readonly checks: BackupChecksService,
    @InjectQueue(BACKUP_QUEUE) private readonly queue: Queue,
    @InjectModel(BackupRun.name)
    private readonly runModel: Model<BackupRunDocument>,
    configService: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {
    this.ns = redisNamespace(configService);
  }

  onApplicationBootstrap(): void {
    void this.markLive();
    void this.cleanTempFiles();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async tick(): Promise<void> {
    await this.markLive();
    try {
      await this.check();
    } catch (err) {
      this.logger.warn(`Backup watchdog check failed: ${sanitizeError(err)}`);
    }
    await this.housekeeping();
  }

  /** Interrupted checks, an expired test database. Never throws. */
  async housekeeping(now = new Date()): Promise<void> {
    try {
      const stale = await this.checks.failStale(STALE_CHECK_MS, now);
      if (stale) {
        this.logger.warn(`Marked ${stale} interrupted backup check(s) failed`);
      }
      const ttl = this.config.testRestoreTtlMs;
      if (ttl && (await this.checks.dropExpiredTestDatabase(ttl, now))) {
        this.logger.log('Expired test-restore database dropped');
      }
    } catch (err) {
      this.logger.warn(`Backup housekeeping failed: ${sanitizeError(err)}`);
    }
  }

  /**
   * Removes temp files (uploaded backups, export spools — ciphertext only)
   * left behind by a crash. Only old ones: another process on this machine
   * may be using recent ones.
   */
  async cleanTempFiles(
    dirs = [UPLOAD_TEMP_DIR_NAME, SPOOL_DIR_NAME].map((d) => join(tmpdir(), d)),
    now = Date.now(),
  ): Promise<number> {
    let removed = 0;
    for (const dir of dirs) {
      let names: string[];
      try {
        names = await readdir(dir);
      } catch {
        continue; // never created
      }
      for (const name of names) {
        const file = join(dir, name);
        try {
          const st = await stat(file);
          if (st.isFile() && now - st.mtimeMs > TEMP_FILE_MAX_AGE_MS) {
            await rm(file, { force: true });
            removed++;
          }
        } catch {
          /* gone meanwhile */
        }
      }
    }
    if (removed)
      this.logger.log(`Removed ${removed} leftover backup temp file(s)`);
    return removed;
  }

  async markLive(): Promise<void> {
    const db = this.connection.db;
    if (!db) return;
    try {
      await markLiveDatabase(db);
    } catch (err) {
      this.logger.warn(
        `Could not mark the live database: ${sanitizeError(err)}`,
      );
    }
  }

  async check(now = new Date()): Promise<WatchdogResult> {
    if (!this.config.serverEnabled || !this.config.credentialsConfigured) {
      return { state: 'inactive' };
    }
    const { settings, address } = await this.store.load();
    if (!settings.enabled) return { state: 'inactive' };

    let schedulerRestored = false;
    if (!(await this.queue.getJobScheduler(BACKUP_SCHEDULER_ID))) {
      this.logger.warn(
        'Backup schedule was missing from Redis; re-applying it',
      );
      await this.scheduler.sync('watchdog: schedule was missing');
      schedulerRestored = true;
    }

    const last = await this.runModel
      .findOne({ kind: 'backup', status: 'succeeded' })
      .sort({ finishedAt: -1 })
      .select('finishedAt')
      .lean();
    const baseline = Math.max(
      last?.finishedAt?.getTime() ?? 0,
      settings.enabledAt?.getTime() ?? 0,
    );
    // No success and no known enable time (enabled before this existed).
    if (!baseline) return { state: 'ok', schedulerRestored };

    const timezone = (await this.store.resolveTimezone(address)).timezone;
    const allowed = 2 * this.intervalMs(settings, timezone) + STALE_GRACE_MS;
    if (now.getTime() - baseline <= allowed) {
      return { state: 'ok', schedulerRestored };
    }

    const since = new Date(baseline);
    const alerted = await this.claimAlert(now);
    if (alerted) {
      const reason = last
        ? `No successful backup since ${since.toISOString()} (expected one at least every ${Math.round(allowed / HOUR_MS)} h).`
        : `Backups were enabled at ${since.toISOString()} but none has succeeded yet.`;
      this.logger.error(`Backups are stale: ${reason}`);
      await this.alerts.send({ kind: 'stale', reason, trigger: 'scheduled' });
    }
    return { state: 'stale', since, alerted, schedulerRestored };
  }

  /** Longest gap between scheduled runs (cron override included). */
  private intervalMs(settings: BackupSettings, timezone: string): number {
    const pattern =
      this.config.cronOverride ??
      buildCronPattern(settings.backupsPerDay, settings.scheduleTime);
    try {
      const runs = BackupScheduler.previewRuns(pattern, timezone, 25);
      let max = 0;
      for (let i = 1; i < runs.length; i++) {
        max = Math.max(max, runs[i].getTime() - runs[i - 1].getTime());
      }
      return max || 24 * HOUR_MS;
    } catch {
      return 24 * HOUR_MS;
    }
  }

  /** True for the one instance allowed to alert in this period. */
  private async claimAlert(now: Date): Promise<boolean> {
    if (this.redis) {
      try {
        const ok = await this.redis.set(
          `${this.ns}:backup-stale-alert`,
          now.toISOString(),
          'PX',
          STALE_ALERT_EVERY_MS,
          'NX',
        );
        return ok === 'OK';
      } catch {
        /* fall back to this process's memory */
      }
    }
    if (now.getTime() - this.lastAlertAt < STALE_ALERT_EVERY_MS) return false;
    this.lastAlertAt = now.getTime();
    return true;
  }
}
