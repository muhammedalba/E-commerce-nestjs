import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { rm } from 'fs/promises';
import { Queue } from 'bullmq';
import { AuditService } from 'src/audit/audit.service';
import { BackupActor, auditBackup } from './backup-audit';
import { BackupChecksService } from './backup-checks.service';
import { BackupFilesService, InspectedUpload } from './backup-files.service';
import { BackupConfig } from './backup.config';
import { BackupLocator } from './backup-locator';
import {
  BACKUP_QUEUE,
  BackupCheckJobData,
  CHECK_JOB_OPTIONS,
  RESTORE_UPLOADS_DEDUP_ID,
  RESTORE_UPLOADS_JOB,
  RestoreUploadsMode,
  TEST_RESTORE_DEDUP_ID,
  TEST_RESTORE_JOB,
  VERIFY_BACKUP_JOB,
  sanitizeError,
} from './backup.types';

/** An HTTP error's own message (written for admins), else the sanitized error. */
function errorText(err: unknown): string {
  if (err instanceof HttpException) return err.message;
  return sanitizeError(err);
}

/**
 * Admin operations on existing backups: list, verify, test restore,
 * download link, upload, delete uploaded. Heavy work runs as BullMQ jobs
 * (HTTP answers 202 with the check id the UI polls).
 */
@Injectable()
export class BackupOperationsService {
  private readonly logger = new Logger(BackupOperationsService.name);

  constructor(
    private readonly checks: BackupChecksService,
    private readonly files: BackupFilesService,
    private readonly locator: BackupLocator,
    private readonly config: BackupConfig,
    private readonly audit: AuditService,
    @InjectQueue(BACKUP_QUEUE)
    private readonly queue: Queue<BackupCheckJobData>,
  ) {}

  private assertConfigured() {
    const missing = this.config.missingCredentials();
    if (missing.length) {
      throw new BadRequestException(
        `Google Drive is not configured on the server: ${missing.join(', ')}`,
      );
    }
  }

  private log(action: string, actor: BackupActor, data: object) {
    return auditBackup(this.audit, this.logger, action, actor, {
      newData: data,
    });
  }

  /** `GET /backup/files` */
  async list(fresh = false) {
    this.assertConfigured();
    return this.checks.listBackups({ fresh });
  }

  /** `GET /backup/checks/:checkId` */
  async getCheck(checkId: string) {
    return this.checks.getCheck(checkId);
  }

  /**
   * Creates the check record and queues its job, at most one per `dedupId`.
   * The job id is derived from the check, so a duplicate request that slips
   * past the first test (two clicks at once) is recognised — BullMQ then
   * answers with the existing job's id — and its check is removed instead
   * of staying "queued" forever.
   */
  private async enqueueCheck(params: {
    job: string;
    kind: 'verify' | 'test-restore' | 'restore-uploads';
    fileId: string;
    backupId: string;
    actor: BackupActor;
    dedupId: string;
    busy: string;
    mode?: RestoreUploadsMode;
    audit: { action: string; data: object };
  }): Promise<{ checkId: string; jobId: string | null }> {
    const { actor } = params;
    if (await this.queue.getDeduplicationJobId(params.dedupId)) {
      throw new ConflictException(params.busy);
    }
    const checkId = await this.checks.createCheck({
      kind: params.kind,
      fileId: params.fileId,
      backupId: params.backupId,
      trigger: 'manual',
      requestedBy: actor.userId,
      mode: params.mode,
    });
    const jobId = `check-${checkId}`;
    const job = await this.queue.add(
      params.job,
      {
        checkId,
        fileId: params.fileId,
        requestedBy: actor.userId,
        ...(params.mode && { mode: params.mode }),
      },
      { ...CHECK_JOB_OPTIONS, jobId, deduplication: { id: params.dedupId } },
    );
    if (job.id !== jobId) {
      await this.checks.deleteCheck(checkId);
      throw new ConflictException(params.busy);
    }
    await this.checks.attachJob(checkId, job.id);
    await this.log(params.audit.action, actor, params.audit.data);
    return { checkId, jobId: job.id ?? null };
  }

  /** `POST /backup/files/:fileId/verify` → 202 */
  async queueVerify(fileId: string, actor: BackupActor) {
    this.assertConfigured();
    const drive = this.locator.drive();
    const resolved = await this.locator.resolveDbFile(drive, fileId);
    return this.enqueueCheck({
      job: VERIFY_BACKUP_JOB,
      kind: 'verify',
      fileId,
      backupId: resolved.backupId,
      actor,
      dedupId: `verify:${fileId}`,
      busy: 'This backup is already being verified.',
      audit: {
        action: 'VERIFY_BACKUP',
        data: { fileId, backupId: resolved.backupId },
      },
    });
  }

  /** `POST /backup/files/:fileId/test-restore` → 202 */
  async queueTestRestore(fileId: string, actor: BackupActor) {
    this.assertConfigured();
    const drive = this.locator.drive();
    const resolved = await this.locator.resolveDbFile(drive, fileId);
    return this.enqueueCheck({
      job: TEST_RESTORE_JOB,
      kind: 'test-restore',
      fileId,
      backupId: resolved.backupId,
      actor,
      dedupId: TEST_RESTORE_DEDUP_ID,
      busy: 'A test restore is already queued or running.',
      audit: {
        action: 'TEST_RESTORE_BACKUP',
        data: {
          fileId,
          backupId: resolved.backupId,
          database: this.checks.testDatabaseName(),
        },
      },
    });
  }

  /**
   * `POST /backup/files/:fileId/restore-uploads` → 202. Restores the backup's
   * uploaded files into the live uploads folder (or previews it).
   */
  async queueRestoreUploads(
    fileId: string,
    mode: RestoreUploadsMode,
    actor: BackupActor,
  ) {
    this.assertConfigured();
    const drive = this.locator.drive();
    const resolved = await this.locator.resolveDbFile(drive, fileId);
    if (!(await this.locator.findManifest(drive, resolved))) {
      throw new BadRequestException(
        'This backup has no uploaded files to restore.',
      );
    }
    return this.enqueueCheck({
      job: RESTORE_UPLOADS_JOB,
      kind: 'restore-uploads',
      fileId,
      backupId: resolved.backupId,
      actor,
      mode,
      dedupId: RESTORE_UPLOADS_DEDUP_ID,
      busy: 'A restore of uploaded files is already queued or running.',
      audit: {
        action:
          mode === 'preview' ? 'PREVIEW_RESTORE_UPLOADS' : 'RESTORE_UPLOADS',
        data: { fileId, backupId: resolved.backupId, mode },
      },
    });
  }

  /** `GET /backup/test-restore` */
  async getTestRestore() {
    return this.checks.getTestRestore();
  }

  /** `DELETE /backup/test-restore` */
  async dropTestRestore(actor: BackupActor) {
    if (await this.queue.getDeduplicationJobId(TEST_RESTORE_DEDUP_ID)) {
      throw new ConflictException(
        'Wait for the running test restore to finish.',
      );
    }
    const result = await this.checks.dropTestDatabase();
    await this.log('DROP_TEST_RESTORE', actor, result);
    return result;
  }

  /** `POST /backup/files/:fileId/download-link` */
  async createDownloadLink(fileId: string, actor: BackupActor) {
    this.assertConfigured();
    const link = await this.files.createDownloadLink(fileId, actor.userId);
    await this.log('DOWNLOAD_BACKUP', actor, {
      fileId,
      backupId: link.backupId,
    });
    return link;
  }

  /**
   * `POST /backup/files/upload` → 202. The file is checked (header, key,
   * bundle layout) while the request is open, so a bad file is a 400 at
   * once; sending it to Drive then runs in the background — it can take
   * minutes and wait for a running backup, longer than a proxy keeps a
   * request open. The UI polls the returned check; on success it holds the
   * new file id and a deep verification is queued.
   */
  async importUpload(
    file: Express.Multer.File | undefined,
    actor: BackupActor,
  ): Promise<{ checkId: string; jobId: null }> {
    let handedOff = false;
    try {
      this.assertConfigured();
      if (!file?.path) {
        throw new BadRequestException('Choose a backup file to upload');
      }
      const inspected = await this.files.inspectUpload(file.path);
      const checkId = await this.checks.createCheck({
        kind: 'import',
        backupId: inspected.header.backupId,
        trigger: 'manual',
        requestedBy: actor.userId,
      });
      handedOff = true;
      void this.runImport(checkId, inspected, file, actor);
      return { checkId, jobId: null };
    } finally {
      // The temp copy is ciphertext, but it must never linger on the server.
      if (file?.path && !handedOff) await rm(file.path, { force: true });
    }
  }

  /** Background part of an upload. Never throws; the outcome goes on the check. */
  private async runImport(
    checkId: string,
    inspected: InspectedUpload,
    file: Express.Multer.File,
    actor: BackupActor,
  ): Promise<void> {
    try {
      await this.checks.markRunning(checkId);
      const result = await this.files.importInspected(
        inspected,
        file.originalname ?? 'backup',
        actor.userId,
      );
      this.checks.invalidateListing();
      const verify = await this.queueVerify(result.fileId, actor);
      await this.checks.markSucceeded(checkId, {
        driveFileId: result.fileId,
        report: { ...result, verifyCheckId: verify.checkId },
      });
      await this.log('UPLOAD_BACKUP', actor, {
        fileId: result.fileId,
        backupId: result.backupId,
        format: result.format,
        size: file.size,
      });
    } catch (err) {
      this.logger.warn(`Backup upload failed: ${sanitizeError(err)}`);
      await this.checks.markFailed(checkId, errorText(err));
    } finally {
      await rm(file.path, { force: true }).catch(() => undefined);
    }
  }

  /** `DELETE /backup/files/:fileId` (uploaded backups only) */
  async deleteUploaded(fileId: string, actor: BackupActor) {
    this.assertConfigured();
    const result = await this.files.deleteUploaded(fileId);
    this.checks.invalidateListing();
    await this.log('DELETE_UPLOADED_BACKUP', actor, { fileId, ...result });
    return result;
  }
}
