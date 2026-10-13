import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { DelayedError, Job } from 'bullmq';
import { Model } from 'mongoose';
import { BackupAlerts } from './backup-alerts';
import { BackupChecksService } from './backup-checks.service';
import { BackupConfig } from './backup.config';
import { BackupLocks } from './backup.locks';
import { BackupService } from './backup.service';
import { BackupSettingsStore } from './backup-settings.store';
import {
  BACKUP_QUEUE,
  LOCK_WAIT_DELAY_MS,
  MAX_LOCK_WAITS,
  BackupCheckJobData,
  BackupJobData,
  BackupJobResult,
  RESTORE_UPLOADS_JOB,
  SCHEDULED_BACKUP_JOB,
  TEST_RESTORE_JOB,
  VERIFY_BACKUP_JOB,
  sanitizeError,
} from './backup.types';
import { BackupRun, BackupRunDocument } from './schemas/backup-run.schema';

type BackupJob = Job<BackupJobData, BackupJobResult>;
type CheckJob = Job<BackupCheckJobData, BackupJobResult>;
type AnyJob = BackupJob | CheckJob;

const isCheckJob = (job: AnyJob): job is CheckJob =>
  job.name === VERIFY_BACKUP_JOB ||
  job.name === TEST_RESTORE_JOB ||
  job.name === RESTORE_UPLOADS_JOB;

/**
 * Runs backup jobs (scheduled and manual) one at a time per instance, and —
 * through the Redis lock — one at a time across the cluster. A job that
 * finds the lock taken completes as `skipped` (no duplicate backup, no
 * retry storm). Failures are thrown so BullMQ retries with backoff; the
 * admin alert is sent once, after the final attempt.
 */
@Processor(BACKUP_QUEUE, { concurrency: 1 })
export class BackupProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(BackupProcessor.name);

  constructor(
    private readonly backupService: BackupService,
    private readonly store: BackupSettingsStore,
    private readonly config: BackupConfig,
    private readonly locks: BackupLocks,
    private readonly alerts: BackupAlerts,
    @InjectModel(BackupRun.name)
    private readonly runModel: Model<BackupRunDocument>,
    private readonly checks: BackupChecksService,
  ) {
    super();
  }

  /** BACKUP_WORKER_ENABLED=false: another instance runs the backup jobs. */
  async onApplicationBootstrap(): Promise<void> {
    if (this.config.workerEnabled) return;
    await this.worker.close();
    this.logger.log(
      'Backup worker disabled on this instance (BACKUP_WORKER_ENABLED=false)',
    );
  }

  async process(job: AnyJob, token?: string): Promise<BackupJobResult> {
    return isCheckJob(job)
      ? this.processCheck(job, token)
      : this.processBackup(job, token);
  }

  /**
   * Postpones the job by LOCK_WAIT_DELAY_MS without using one of its
   * attempts (BullMQ DelayedError). False once it has waited MAX_LOCK_WAITS
   * times, or when the worker token is unknown.
   */
  private async postpone(job: AnyJob, token?: string): Promise<boolean> {
    const waits = job.data.lockWaits ?? 0;
    if (!token || waits >= MAX_LOCK_WAITS) return false;
    await job.updateData({ ...job.data, lockWaits: waits + 1 } as never);
    await job.moveToDelayed(Date.now() + LOCK_WAIT_DELAY_MS, token);
    return true;
  }

  /**
   * Verify / test-restore / restore-uploads of an existing backup. Waits for
   * whatever holds the lock (a backup, another check, an import).
   */
  private async processCheck(
    job: CheckJob,
    token?: string,
  ): Promise<BackupJobResult> {
    const lock = await this.locks.backup.acquire('check');
    if (!lock) {
      if (await this.postpone(job, token)) throw new DelayedError();
      throw new Error('Another backup operation kept running for too long');
    }
    try {
      const { checkId, fileId } = job.data;
      if (job.name === TEST_RESTORE_JOB) {
        await this.checks.testRestore(checkId, fileId, { signal: lock.signal });
      } else if (job.name === RESTORE_UPLOADS_JOB) {
        await this.checks.restoreUploadedFiles(
          checkId,
          fileId,
          job.data.mode ?? 'preview',
          { signal: lock.signal },
        );
      } else {
        await this.checks.verify(checkId, fileId, {
          deepUploads: true,
          signal: lock.signal,
        });
      }
      const check = await this.checks.getCheck(checkId);
      return { checkId, status: check?.status ?? 'failed' };
    } finally {
      await lock.release();
    }
  }

  private async processBackup(
    job: BackupJob,
    token?: string,
  ): Promise<BackupJobResult> {
    const attempt = job.attemptsMade + 1;
    const settings = await this.store.get();

    // A scheduler can outlive a disable that raced with it; re-check.
    if (
      job.name === SCHEDULED_BACKUP_JOB &&
      (!this.config.serverEnabled || !settings.enabled)
    ) {
      this.logger.log(
        `Scheduled backup ${job.id} skipped: backups are disabled`,
      );
      return { skipped: 'disabled' };
    }

    const lock = await this.locks.backup.acquire('backup');
    if (!lock) {
      // A check or an upload holds the lock: wait for it rather than lose
      // this backup. Another backup: skip (no duplicate backup).
      const holder = await this.locks.backup.holder();
      if (holder !== 'backup' && (await this.postpone(job, token))) {
        this.logger.log(
          `Backup job ${job.id} postponed: the lock is held by ${holder ?? 'another operation'}`,
        );
        throw new DelayedError();
      }
      this.logger.warn(
        `Backup job ${job.id} skipped: ${holder === 'backup' ? 'another backup is already running' : 'the lock stayed busy for too long'}`,
      );
      await this.runModel
        .create({
          kind: 'backup',
          status: 'skipped',
          skipReason: 'locked',
          jobId: job.id ?? null,
          trigger: job.data.trigger,
          attempt,
          startedAt: new Date(),
          finishedAt: new Date(),
        })
        .catch(() => undefined);
      return { skipped: 'locked' };
    }

    try {
      const outcome = await this.backupService.createAndUpload({
        trigger: job.data.trigger,
        jobId: job.id,
        attempt,
        signal: lock.signal,
      });

      // Read the new backup back from Drive first, so retention knows
      // whether it can be trusted. A failure alerts the admins but
      // does not fail or retry the job (retrying would only add a backup).
      try {
        lock.signal.throwIfAborted();
        const checkId = await this.checks.createCheck({
          kind: 'verify',
          fileId: outcome.driveFileId,
          backupId: outcome.backupId,
          trigger: 'auto',
        });
        const status = await this.checks.verify(checkId, outcome.driveFileId, {
          deepUploads: false,
          signal: lock.signal,
          localCopy: outcome.localCopy,
          knownBlobs: outcome.blobIds ? new Set(outcome.blobIds) : undefined,
        });
        if (status !== 'succeeded') {
          await this.sendFailureAlert(
            job,
            `Backup ${outcome.backupId} was created but FAILED verification. Open Admin > Backups for details.`,
            'unverified',
          );
        }
      } catch (err) {
        this.logger.warn(
          `Automatic verification of ${outcome.backupId} could not run: ${sanitizeError(err)}`,
        );
      } finally {
        await this.backupService.discardLocalCopy(outcome);
      }

      // Retention only after a verified upload; its failure never fails the backup.
      try {
        lock.signal.throwIfAborted();
        const { retentionDays } = await this.store.get();
        await this.backupService.applyRetention({
          runId: outcome.runId,
          folderId: outcome.folderId,
          retentionDays,
          protectId: outcome.driveFileId,
        });
      } catch (err) {
        this.logger.warn(
          `Backup ${outcome.backupId} succeeded but retention failed: ${sanitizeError(err)}`,
        );
      }

      // New file, maybe deleted old ones: the next list must come from Drive.
      this.checks.invalidateListing();
      return {
        runId: outcome.runId,
        driveFileId: outcome.driveFileId,
        sizeBytes: outcome.sizeBytes,
      };
    } finally {
      await lock.release();
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: AnyJob | undefined, error: Error): Promise<void> {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    const safeError = sanitizeError(error);
    if (isCheckJob(job)) {
      // Manual checks: record the outcome on the check; no email.
      if (job.attemptsMade >= maxAttempts) {
        await this.checks.markFailed(job.data.checkId, error);
      }
      return;
    }
    if (job.attemptsMade < maxAttempts) {
      this.logger.warn(
        `Backup job ${job.id} attempt ${job.attemptsMade}/${maxAttempts} failed, will retry: ${safeError}`,
      );
      return;
    }
    this.logger.error(
      `Backup job ${job.id} failed after ${job.attemptsMade} attempts: ${safeError}`,
    );
    await this.sendFailureAlert(job, safeError);
  }

  /** Queues the admin email + in-app notification. Never throws. */
  async sendFailureAlert(
    job: BackupJob,
    safeError: string,
    kind: 'failed' | 'unverified' = 'failed',
  ): Promise<void> {
    await this.alerts.send({
      kind,
      reason: safeError,
      jobId: String(job.id ?? 'N/A'),
      trigger: job.data.trigger,
      attemptsMade: job.attemptsMade,
    });
  }
}
