import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import { AuditService } from 'src/audit/audit.service';
import { BackupActor, auditBackup } from './backup-audit';
import { BackupConfig } from './backup.config';
import { BackupLocks, GoogleDriveClientFactory } from './backup.locks';
import { BACKUP_JOB_OPTIONS, BackupScheduler } from './backup.scheduler';
import { BackupSettingsStore } from './backup-settings.store';
import {
  BACKUP_QUEUE,
  BackupJobData,
  BackupSettings,
  MANUAL_BACKUP_DEDUP_ID,
  MANUAL_BACKUP_JOB,
  MIN_BACKUPS_KEPT,
  SUPPORTED_BACKUPS_PER_DAY,
  SUPPORTED_RETENTION_DAYS,
  buildCronPattern,
  sanitizeError,
  scheduleRunTimes,
} from './backup.types';
import { UpdateBackupSettingsDto } from './dto/update-backup-settings.dto';
import { BackupRun, BackupRunDocument } from './schemas/backup-run.schema';

export type { BackupActor };

/** Admin-facing operations behind `/backup/*`. Never returns secrets. */
@Injectable()
export class BackupAdminService {
  private readonly logger = new Logger(BackupAdminService.name);

  constructor(
    private readonly store: BackupSettingsStore,
    private readonly scheduler: BackupScheduler,
    private readonly config: BackupConfig,
    private readonly locks: BackupLocks,
    private readonly driveFactory: GoogleDriveClientFactory,
    private readonly audit: AuditService,
    @InjectQueue(BACKUP_QUEUE) private readonly queue: Queue<BackupJobData>,
    @InjectModel(BackupRun.name)
    private readonly runModel: Model<BackupRunDocument>,
  ) {}

  private serverInfo() {
    return {
      enabled: this.config.serverEnabled,
      credentialsConfigured: this.config.credentialsConfigured,
      /** Names only — never values. */
      missing: this.config.missingCredentials(),
      scheduleOverridden: !!this.config.cronOverride,
      /** Largest file the panel may upload (BACKUP_UPLOAD_MAX_MB). */
      uploadMaxBytes: this.config.uploadMaxBytes,
    };
  }

  /** `GET /backup/settings` */
  async getSettings() {
    const { settings, address } = await this.store.load();
    const timezone = await this.store.resolveTimezone(address);
    const pattern =
      this.config.cronOverride ??
      buildCronPattern(settings.backupsPerDay, settings.scheduleTime);
    return {
      settings,
      timezone,
      schedule: {
        pattern,
        runTimes: this.config.cronOverride
          ? []
          : scheduleRunTimes(settings.backupsPerDay, settings.scheduleTime),
        upcoming: BackupScheduler.previewRuns(pattern, timezone.timezone, 3),
      },
      options: {
        backupsPerDay: [...SUPPORTED_BACKUPS_PER_DAY],
        retentionDays: [...SUPPORTED_RETENTION_DAYS],
        minBackupsKept: MIN_BACKUPS_KEPT,
      },
      server: this.serverInfo(),
    };
  }

  /** `PATCH /backup/settings` — persist, audit, then apply to the scheduler. */
  async updateSettings(dto: UpdateBackupSettingsDto, actor: BackupActor) {
    if (dto.enabled === true) {
      if (!this.config.serverEnabled) {
        throw new BadRequestException(
          'Backups are disabled on the server (BACKUP_ENABLED is not true).',
        );
      }
      const missing = this.config.missingCredentials();
      if (missing.length) {
        throw new BadRequestException(
          `Cannot enable backups: missing or invalid server configuration: ${missing.join(', ')}`,
        );
      }
    }

    const previous = await this.store.get();
    const updated = await this.store.update(dto);
    await auditBackup(
      this.audit,
      this.logger,
      'UPDATE_BACKUP_SETTINGS',
      actor,
      {
        previousData: this.auditView(previous),
        newData: this.auditView(updated),
      },
    );
    this.logger.log(
      `Backup settings updated by ${actor.email ?? actor.userId ?? 'unknown'}: ` +
        JSON.stringify(this.auditView(updated)),
    );

    try {
      await this.scheduler.sync('settings updated');
    } catch (err) {
      this.logger.error(
        `Backup settings saved but the schedule could not be applied: ${sanitizeError(err)}`,
      );
      throw new ServiceUnavailableException(
        'Settings were saved, but the backup schedule could not be updated. It will be retried on the next save or server restart; the previous schedule may still be active.',
      );
    }
    return this.getSettings();
  }

  private auditView(s: BackupSettings) {
    return {
      enabled: s.enabled,
      backupsPerDay: s.backupsPerDay,
      scheduleTime: s.scheduleTime,
      retentionDays: s.retentionDays,
      folderName: s.googleDrive.folderName,
    };
  }

  /** `GET /backup/status` — from run records and BullMQ; no Drive calls. */
  async getStatus() {
    const [
      lastSuccess,
      lastFailure,
      lastFinished,
      lastConnectionTest,
      nextRunAt,
      lockHolder,
      manualJobId,
    ] = await Promise.all([
      this.runModel
        .findOne({ kind: 'backup', status: 'succeeded' })
        .sort({ finishedAt: -1 })
        .lean(),
      this.runModel
        .findOne({ kind: 'backup', status: 'failed' })
        .sort({ finishedAt: -1 })
        .lean(),
      this.runModel
        .findOne({
          kind: 'backup',
          status: { $in: ['succeeded', 'failed', 'skipped'] },
        })
        .sort({ finishedAt: -1 })
        .lean(),
      this.runModel
        .findOne({ kind: 'connection-test' })
        .sort({ finishedAt: -1 })
        .lean(),
      this.scheduler.nextRunAt().catch(() => null),
      this.locks.backup.holder(),
      this.queue
        .getDeduplicationJobId(MANUAL_BACKUP_DEDUP_ID)
        .catch(() => null),
    ]);

    return {
      server: this.serverInfo(),
      scheduler: { active: !!nextRunAt, nextRunAt },
      // Only a backup counts: checks and imports also take the lock.
      running: lockHolder === 'backup',
      // The dedup id lives while the manual job waits, is postponed or runs.
      manualQueued: !!manualJobId && lockHolder !== 'backup',
      lastResult: lastFinished
        ? {
            status: lastFinished.status,
            at: lastFinished.finishedAt,
            trigger: lastFinished.trigger,
          }
        : null,
      lastSuccess: lastSuccess
        ? {
            at: lastSuccess.finishedAt,
            fileName: lastSuccess.fileName,
            driveFileId: lastSuccess.driveFileId,
            sizeBytes: lastSuccess.sizeBytes,
            totalDocs: lastSuccess.totalDocs,
            durationMs: lastSuccess.durationMs,
            consistency: lastSuccess.consistency,
            uploads: lastSuccess.uploads
              ? {
                  files: lastSuccess.uploads.files,
                  totalBytes: lastSuccess.uploads.totalBytes,
                }
              : null,
          }
        : null,
      lastFailure: lastFailure
        ? { at: lastFailure.finishedAt, error: lastFailure.error }
        : null,
      retainedCount: lastSuccess?.retainedCount ?? null,
      connection: this.connectionStatus(lastConnectionTest, lastSuccess),
    };
  }

  private connectionStatus(
    test: BackupRun | null,
    success: BackupRun | null,
  ): {
    status: 'not-configured' | 'connected' | 'failed' | 'unknown';
    checkedAt: Date | null;
    error: string | null;
  } {
    if (!this.config.credentialsConfigured) {
      return { status: 'not-configured', checkedAt: null, error: null };
    }
    const testAt = test?.finishedAt?.getTime() ?? 0;
    const successAt = success?.finishedAt?.getTime() ?? 0;
    if (!testAt && !successAt) {
      return { status: 'unknown', checkedAt: null, error: null };
    }
    if (successAt > testAt) {
      return {
        status: 'connected',
        checkedAt: success!.finishedAt,
        error: null,
      };
    }
    return test!.status === 'succeeded'
      ? { status: 'connected', checkedAt: test!.finishedAt, error: null }
      : { status: 'failed', checkedAt: test!.finishedAt, error: test!.error };
  }

  /** `POST /backup/test-connection` — authenticates and looks up the folder. */
  async testConnection(actor: BackupActor) {
    const missing = this.config.missingCredentials();
    if (missing.length) {
      throw new BadRequestException(
        `Google Drive is not configured on the server: ${missing.join(', ')}`,
      );
    }
    const settings = await this.store.get();
    const startedAt = new Date();
    try {
      const result = await this.driveFactory
        .create()
        .testConnection(
          settings.googleDrive.folderName,
          settings.googleDrive.folderId || undefined,
        );
      await this.runModel.create({
        kind: 'connection-test',
        status: 'succeeded',
        startedAt,
        finishedAt: new Date(),
      });
      this.logger.log(
        `Drive connection test succeeded (by ${actor.email ?? actor.userId ?? 'unknown'})`,
      );
      return {
        status: 'connected' as const,
        folderName: settings.googleDrive.folderName,
        folderExists: result.folderExists,
        folderId: result.folderId,
      };
    } catch (err) {
      const error = sanitizeError(err);
      await this.runModel
        .create({
          kind: 'connection-test',
          status: 'failed',
          startedAt,
          finishedAt: new Date(),
          error,
        })
        .catch(() => undefined);
      this.logger.warn(`Drive connection test failed: ${error}`);
      return { status: 'failed' as const, error };
    }
  }

  /** `POST /backup/run` — queues one manual backup (202) or refuses (409). */
  async runNow(actor: BackupActor) {
    if (!this.config.serverEnabled) {
      throw new BadRequestException(
        'Backups are disabled on the server (BACKUP_ENABLED is not true).',
      );
    }
    const missing = this.config.missingCredentials();
    if (missing.length) {
      throw new BadRequestException(
        `Cannot run a backup: missing or invalid server configuration: ${missing.join(', ')}`,
      );
    }
    // A check or an import holding the lock is fine: the job waits for it.
    if ((await this.locks.backup.holder()) === 'backup') {
      throw new ConflictException('A backup is already running.');
    }
    const existing = await this.queue.getDeduplicationJobId(
      MANUAL_BACKUP_DEDUP_ID,
    );
    if (existing) {
      throw new ConflictException('A manual backup is already queued.');
    }
    const job = await this.queue.add(
      MANUAL_BACKUP_JOB,
      { trigger: 'manual', requestedBy: actor.userId },
      {
        ...BACKUP_JOB_OPTIONS,
        deduplication: { id: MANUAL_BACKUP_DEDUP_ID },
      },
    );
    await auditBackup(this.audit, this.logger, 'RUN_MANUAL_BACKUP', actor, {
      newData: { jobId: job.id },
    });
    this.logger.log(
      `Manual backup ${job.id} queued by ${actor.email ?? actor.userId ?? 'unknown'}`,
    );
    return { jobId: job.id ?? null, queued: true };
  }
}
