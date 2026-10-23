import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import {
  SETTINGS_UPDATED_EVENT,
  SettingsUpdatedEvent,
} from 'src/settings/shared/settings.events';
import { BackupConfig } from './backup.config';
import { BackupLocks } from './backup.locks';
import { BackupSettingsStore } from './backup-settings.store';
import {
  BACKUP_QUEUE,
  BACKUP_SCHEDULER_ID,
  BackupJobData,
  SCHEDULED_BACKUP_JOB,
  buildCronPattern,
  sanitizeError,
} from './backup.types';
import { ResolvedTimezone } from './store-timezone';

/** Options every backup job (scheduled or manual) runs with. */
export const BACKUP_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 60_000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 200 },
};

export interface SchedulerState {
  active: boolean;
  /** Why it is inactive, when it is. */
  reason?: 'server-disabled' | 'admin-disabled' | 'credentials-missing';
  pattern?: string;
  timezone: ResolvedTimezone;
  overridden: boolean;
}

/**
 * Keeps the BullMQ job scheduler `db-backup` in line with the persisted
 * admin settings (the source of truth), the env master switch / cron
 * override, and the timezone derived from the store address.
 *
 * Every sync runs under a cluster-wide lock and re-reads the settings inside
 * it, so concurrent syncs (startup of several instances, an admin save, an
 * address change) serialize and the last one always applies the latest
 * persisted state. `upsertJobScheduler` with the stable id never creates a
 * second scheduler; disabling removes it (existing backup files are kept).
 */
@Injectable()
export class BackupScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(
    @InjectQueue(BACKUP_QUEUE)
    private readonly queue: Queue<BackupJobData>,
    private readonly config: BackupConfig,
    private readonly store: BackupSettingsStore,
    private readonly locks: BackupLocks,
  ) {}

  /** Not awaited: never delay `listen()` on Redis/Mongo (see ExchangeRateSync). */
  onApplicationBootstrap(): void {
    void this.syncAtStartup();
  }

  /**
   * Redis may still be connecting at boot (the app client has no offline
   * queue), so wait for it first, then retry a few times. A schedule saved
   * earlier stays active in BullMQ meanwhile; this only re-applies the
   * persisted settings.
   */
  async syncAtStartup(
    attempts = 5,
    delayMs = 5_000,
    readyTimeoutMs = 10_000,
  ): Promise<void> {
    await this.locks.whenReady(readyTimeoutMs);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await this.sync('startup');
        return;
      } catch (err) {
        const last = attempt === attempts;
        this.logger[last ? 'error' : 'warn'](
          `Backup scheduler sync at startup failed (attempt ${attempt}/${attempts}): ${sanitizeError(err)}`,
        );
        if (last) return;
        await new Promise((r) => setTimeout(r, delayMs * attempt));
      }
    }
  }

  @OnEvent(SETTINGS_UPDATED_EVENT)
  async onSettingsUpdated(event: SettingsUpdatedEvent): Promise<void> {
    if (!event?.changedKeys?.includes('businessAddress')) return;
    try {
      await this.sync('store address changed');
    } catch (err) {
      this.logger.error(
        `Backup scheduler sync after address change failed: ${sanitizeError(err)}`,
      );
    }
  }

  /** Applies the persisted configuration to BullMQ. Throws if it could not. */
  async sync(reason: string): Promise<SchedulerState> {
    const lock = await this.locks.scheduler.acquireWithWait(15_000);
    if (!lock) {
      throw new Error('Timed out waiting for the backup scheduler lock');
    }
    try {
      const { settings, address } = await this.store.load();
      const timezone = await this.store.resolveTimezone(address);
      const overridden = !!this.config.cronOverride;

      const reasonInactive: SchedulerState['reason'] = !this.config
        .serverEnabled
        ? 'server-disabled'
        : !this.config.credentialsConfigured
          ? 'credentials-missing'
          : !settings.enabled
            ? 'admin-disabled'
            : undefined;

      if (reasonInactive) {
        const removed =
          await this.queue.removeJobScheduler(BACKUP_SCHEDULER_ID);
        if (removed) {
          this.logger.log(
            `Backup schedule removed (${reasonInactive}; ${reason})`,
          );
        }
        return { active: false, reason: reasonInactive, timezone, overridden };
      }

      const pattern =
        this.config.cronOverride ??
        buildCronPattern(settings.backupsPerDay, settings.scheduleTime);
      await this.queue.upsertJobScheduler(
        BACKUP_SCHEDULER_ID,
        { pattern, tz: timezone.timezone },
        {
          name: SCHEDULED_BACKUP_JOB,
          data: { trigger: 'scheduled' },
          opts: BACKUP_JOB_OPTIONS,
        },
      );
      this.logger.log(
        `Backup schedule set: "${pattern}" ${timezone.timezone} (${timezone.source}${overridden ? ', BACKUP_CRON override' : ''}; ${reason})`,
      );
      return { active: true, pattern, timezone, overridden };
    } finally {
      await lock.release();
    }
  }

  /** Next run time from BullMQ, or null when no scheduler exists. */
  async nextRunAt(): Promise<Date | null> {
    const scheduler = await this.queue.getJobScheduler(BACKUP_SCHEDULER_ID);
    return scheduler?.next ? new Date(scheduler.next) : null;
  }

  /** Upcoming run times for a pattern/zone (what the admin UI previews). */
  static previewRuns(
    pattern: string,
    timezone: string,
    count: number,
    from = new Date(),
  ): Date[] {
    const it = CronExpressionParser.parse(pattern, {
      tz: timezone,
      currentDate: from,
    });
    return Array.from({ length: count }, () => it.next().toDate());
  }
}
