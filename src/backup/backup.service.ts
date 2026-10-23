import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { BackupConfig } from './backup.config';
import { BackupEncryptStream, createBackupHeader } from './backup-format';
import { ExportStats, exportDatabase } from './backup-export';
import { BackupSettingsStore } from './backup-settings.store';
import { GoogleDriveClientFactory } from './backup.locks';
import { BackupTrigger, SPOOL_DIR_NAME, sanitizeError } from './backup.types';
import { GoogleDriveClient, UploadResult } from './google-drive.client';
import {
  UploadsBackupOutcome,
  UploadsBackupService,
  UploadsPruneResult,
} from './uploads/uploads-backup.service';
import {
  BACKUP_CREATED_AT_PROPERTY,
  BACKUP_KIND_PROPERTY,
  BACKUP_KIND_VALUE,
  BACKUP_STATUS_PROPERTY,
  isValidBackupFile,
  selectBackupsToDelete,
} from './retention';
import { BackupRun, BackupRunDocument } from './schemas/backup-run.schema';

export interface BackupOutcome {
  runId: string;
  backupId: string;
  fileName: string;
  driveFileId: string;
  folderId: string;
  sizeBytes: number;
  totalDocs: number;
  /**
   * The encrypted file exactly as uploaded (Drive's MD5 matched it). The
   * caller verifies from it instead of downloading it again, then MUST
   * remove it (see {@link BackupService.discardLocalCopy}).
   */
  localCopy: { path: string; md5: string };
  /** Blob ids in Drive after this backup (null: no uploads folder). */
  blobIds: string[] | null;
}

export interface RetentionOutcome {
  deleted: number;
  failed: number;
  retained: number;
}

/** Encrypted backups are written here before the upload (ciphertext only). */
export const BACKUP_SPOOL_DIR = join(tmpdir(), SPOOL_DIR_NAME);

/** `2026-10-12T03-00-00Z` — sortable and safe in file names. */
const fileStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/:/g, '-');

/**
 * Creates encrypted backups and applies retention. Callers (the processor)
 * must hold the cluster-wide backup lock and pass its abort signal.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(BackupRun.name)
    private readonly runModel: Model<BackupRunDocument>,
    private readonly config: BackupConfig,
    private readonly store: BackupSettingsStore,
    private readonly driveFactory: GoogleDriveClientFactory,
    private readonly uploads: UploadsBackupService,
  ) {}

  /**
   * Exports the database (snapshot) → gzip → AES-256-GCM into a temp file,
   * then uploads that file to Drive (resumable). Spooling first keeps the
   * snapshot read as short as the export itself: streamed straight into the
   * upload it would last as long as the upload, and snapshot reads fail once
   * they outlive the server's history window (300 s on Atlas). Resolves only
   * after Drive's size + MD5 matched; otherwise rejects (the Drive client
   * removes any partial upload) and records the failure. The temp file is
   * always removed.
   */
  async createAndUpload(params: {
    trigger: BackupTrigger;
    jobId?: string;
    attempt?: number;
    signal?: AbortSignal;
  }): Promise<BackupOutcome> {
    const startedAt = new Date();
    const backupId = `${fileStamp(startedAt)}-${randomBytes(3).toString('hex')}`;
    const run = await this.runModel.create({
      kind: 'backup',
      status: 'running',
      backupId,
      jobId: params.jobId ?? null,
      trigger: params.trigger,
      attempt: params.attempt ?? 1,
      startedAt,
    });
    const stats: ExportStats = {
      collections: {},
      totalDocs: 0,
      consistency: 'snapshot',
      completed: false,
    };

    let spool: string | null = null;
    let succeeded = false;
    try {
      const missing = this.config.missingCredentials();
      if (missing.length) {
        throw new Error(`Backup credentials missing: ${missing.join(', ')}`);
      }
      const db = this.connection.db;
      if (!db) throw new Error('MongoDB connection is not ready');

      const drive = this.driveFactory.create();
      const settings = await this.store.get();
      const folder = await drive.ensureFolder(
        settings.googleDrive.folderName,
        settings.googleDrive.folderId || undefined,
      );
      if (folder.id !== settings.googleDrive.folderId) {
        await this.store.setFolderId(folder.id);
      }
      if (folder.created || folder.renamed) {
        this.logger.log(
          `Backup folder ${folder.created ? 'created' : 'renamed'}: ${folder.id}`,
        );
      }

      const key = this.config.encryptionKey();
      const { header, iv } = createBackupHeader({
        backupId,
        createdAt: startedAt,
        sourceDb: db.databaseName,
        key,
      });
      const fileName = `skygalaxy-${backupId}.sgbk`;
      this.logger.log(
        `Backup ${backupId} started (${params.trigger}, attempt ${params.attempt ?? 1})`,
      );

      await mkdir(BACKUP_SPOOL_DIR, { recursive: true, mode: 0o700 });
      spool = join(BACKUP_SPOOL_DIR, `${backupId}.sgbk.part`);
      await pipeline(
        Readable.from(
          exportDatabase({
            db,
            client: this.connection.getClient(),
            backupId,
            createdAt: startedAt,
            batchSize: this.config.batchSize,
            readPreference: this.config.readPreference,
            allowNonSnapshot: this.config.allowNonSnapshot,
            stats,
            signal: params.signal,
          }),
          { objectMode: false },
        ),
        createGzip({ level: 6 }),
        new BackupEncryptStream(key, header, iv),
        createWriteStream(spool, { mode: 0o600 }),
        ...(params.signal ? [{ signal: params.signal }] : []),
      );
      if (!stats.completed) {
        throw new Error('Backup pipeline ended before the export completed');
      }

      const uploaded: UploadResult = await drive.uploadResumable(
        createReadStream(spool),
        {
          name: fileName,
          folderId: folder.id,
          appProperties: {
            [BACKUP_KIND_PROPERTY]: BACKUP_KIND_VALUE,
            [BACKUP_CREATED_AT_PROPERTY]: startedAt.toISOString(),
            // Complete only once the uploads manifest is saved too.
            [BACKUP_STATUS_PROPERTY]: 'partial',
            sgbkBackupId: backupId,
            sgbkFormat: String(header.formatVersion),
            sgbkKeyId: header.keyId,
          },
          signal: params.signal,
        },
      );

      // The database file is complete and verified in Drive at this point;
      // the run only counts as successful once the uploads are saved too.
      let uploadsResult: UploadsBackupOutcome | null;
      try {
        uploadsResult = await this.uploads.backup({
          drive,
          folderId: folder.id,
          backupId,
          createdAt: startedAt,
          sourceDb: db.databaseName,
          key,
          signal: params.signal,
        });
      } catch (err) {
        // The raw error is deliberately not attached as `cause`: only its sanitized form may surface.
        // eslint-disable-next-line preserve-caught-error
        throw new Error(
          `Database file ${uploaded.id} was saved, but the uploads backup failed: ${sanitizeError(err)}`,
        );
      }
      try {
        await drive.setAppProperties(uploaded.id, {
          [BACKUP_STATUS_PROPERTY]: 'complete',
        });
      } catch (err) {
        // Still a full backup; retention just won't count it among the trusted ones.
        this.logger.warn(
          `Backup ${backupId}: could not mark the file complete: ${sanitizeError(err)}`,
        );
      }

      const finishedAt = new Date();
      await this.runModel.updateOne(
        { _id: run._id },
        {
          $set: {
            status: 'succeeded',
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            fileName,
            driveFileId: uploaded.id,
            sizeBytes: uploaded.sizeBytes,
            totalDocs: stats.totalDocs,
            collections: stats.collections,
            consistency: stats.consistency,
            uploads: uploadsResult && {
              manifestId: uploadsResult.manifestId,
              files: uploadsResult.files,
              totalBytes: uploadsResult.totalBytes,
              uploadedBlobs: uploadsResult.uploadedBlobs,
              reusedBlobs: uploadsResult.reusedBlobs,
              skippedTooLarge: uploadsResult.skippedTooLarge,
            },
          },
        },
      );
      this.logger.log(
        `Backup ${backupId} succeeded in ${finishedAt.getTime() - startedAt.getTime()} ms: ` +
          `${Object.keys(stats.collections).length} collections, ${stats.totalDocs} documents, ` +
          `${uploaded.sizeBytes} bytes encrypted, consistency=${stats.consistency}, Drive file ${uploaded.id}`,
      );
      if (stats.consistency === 'none') {
        this.logger.warn(
          `Backup ${backupId} is NOT point-in-time consistent (BACKUP_ALLOW_NON_SNAPSHOT=true)`,
        );
      }

      succeeded = true;
      return {
        runId: String(run._id),
        backupId,
        fileName,
        driveFileId: uploaded.id,
        folderId: folder.id,
        sizeBytes: uploaded.sizeBytes,
        totalDocs: stats.totalDocs,
        localCopy: { path: spool, md5: uploaded.md5 },
        blobIds: uploadsResult?.blobIds ?? null,
      };
    } catch (err) {
      const error = sanitizeError(
        params.signal?.aborted ? (params.signal.reason ?? err) : err,
      );
      const finishedAt = new Date();
      await this.runModel
        .updateOne(
          { _id: run._id },
          {
            $set: {
              status: 'failed',
              finishedAt,
              durationMs: finishedAt.getTime() - startedAt.getTime(),
              error,
              totalDocs: stats.totalDocs,
              collections: stats.collections,
            },
          },
        )
        .catch(() => undefined);
      this.logger.error(`Backup ${backupId} failed: ${error}`);
      throw err;
    } finally {
      // On success the caller owns the file (localCopy) and removes it.
      if (spool && !succeeded) {
        await rm(spool, { force: true }).catch(() => undefined);
      }
    }
  }

  /** Removes the local copy a successful {@link createAndUpload} left. */
  async discardLocalCopy(outcome: Pick<BackupOutcome, 'localCopy'>) {
    await rm(outcome.localCopy.path, { force: true }).catch(() => undefined);
  }

  /**
   * Deletes backups past `retentionDays`, never touching the newest
   * MIN_BACKUPS_KEPT valid backups or `protectId`. Only runs after a
   * successful upload; a failed deletion is logged and counted, never thrown.
   */
  async applyRetention(params: {
    runId: string;
    folderId: string;
    retentionDays: number;
    protectId: string;
    drive?: GoogleDriveClient;
  }): Promise<RetentionOutcome> {
    const drive = params.drive ?? this.driveFactory.create();
    const files = await drive.listBackups(params.folderId);
    const toDelete = selectBackupsToDelete(
      files,
      new Date(),
      params.retentionDays,
      undefined,
      params.protectId,
    );
    let deleted = 0;
    let failed = 0;
    for (const file of toDelete) {
      try {
        await drive.deleteFile(file.id);
        deleted++;
        this.logger.log(`Retention deleted backup ${file.name} (${file.id})`);
      } catch (err) {
        failed++;
        this.logger.warn(
          `Retention could not delete ${file.name} (${file.id}): ${sanitizeError(err)}`,
        );
      }
    }
    const retained = files.filter(isValidBackupFile).length - deleted;

    // Uploads follow the database backups that are left.
    let uploadsPrune: UploadsPruneResult | null = null;
    try {
      uploadsPrune = await this.uploads.prune({
        drive,
        folderId: params.folderId,
        keys: this.config.decryptionKeys(),
      });
    } catch (err) {
      failed++;
      this.logger.warn(`Uploads retention failed: ${sanitizeError(err)}`);
    }

    await this.runModel
      .updateOne(
        { _id: params.runId },
        {
          $set: {
            retention: {
              deleted,
              failed,
              uploadManifestsDeleted: uploadsPrune?.manifestsDeleted ?? 0,
              uploadBlobsDeleted: uploadsPrune?.blobsDeleted ?? 0,
            },
            retainedCount: retained,
          },
        },
      )
      .catch(() => undefined);
    return { deleted, failed, retained };
  }
}
