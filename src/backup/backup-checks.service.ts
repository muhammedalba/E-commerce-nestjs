import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createReadStream } from 'fs';
import { Connection, Model, Types } from 'mongoose';
import { BackupConfig } from './backup.config';
import { BackupLocator, ResolvedBackupFile } from './backup-locator';
import {
  DB_UPLOAD_KIND,
  MANIFEST_UPLOAD_KIND,
  RestoreUploadsMode,
  sanitizeError,
} from './backup.types';
import { DriveFile, GoogleDriveClient } from './google-drive.client';
import { restoreIntoDatabase, verifyBackupSource } from './restore';
import {
  BACKUP_KIND_VALUE,
  BACKUP_VERIFIED_PROPERTY,
  backupTimestamp,
} from './retention';
import { BackupFormatError } from './backup-format';
import {
  BackupCheck,
  BackupCheckDocument,
  BackupCheckKind,
} from './schemas/backup-check.schema';
import { BackupRun, BackupRunDocument } from './schemas/backup-run.schema';
import {
  UploadsRestoreError,
  UploadsRestoreReport,
  UploadsSource,
  UploadsVerifyReport,
  driveUploadsSource,
  restoreUploads,
  verifyUploads,
} from './uploads/restore-uploads';
import { getUploadsRoot } from 'src/shared/utils/upload-path.util';
import { MANIFEST_KIND } from './uploads/uploads-format';
import {
  assertNotLiveDatabase,
  isInternalCollection,
  liveMarkerOf,
} from './live-marker';

export type BackupSource = 'scheduled' | 'manual' | 'uploaded' | 'unknown';

export interface BackupListItem {
  fileId: string;
  backupId: string;
  name: string;
  source: BackupSource;
  createdAt: string | null;
  sizeBytes: number | null;
  totalDocs: number | null;
  hasUploads: boolean;
  uploadedFiles: number | null;
  verification: {
    status: BackupCheck['status'];
    trigger: BackupCheck['trigger'];
    at: Date | null;
    error: string | null;
  } | null;
}

export interface ComparisonRow {
  collection: string;
  backup: number;
  restored: number;
  live: number | null;
}

/** How long the Drive listing behind GET /backup/files is reused. */
const LISTING_TTL_MS = 20_000;

interface DriveListing {
  made: DriveFile[];
  uploaded: DriveFile[];
  manifests: DriveFile[];
  uploadedManifests: DriveFile[];
}

/** Writes test-restore progress at most this often. */
const PROGRESS_INTERVAL_MS = 2000;

/**
 * Verification and test restores of backups straight from Google Drive.
 * Callers (the processor) hold the cluster-wide backup lock.
 */
@Injectable()
export class BackupChecksService {
  private readonly logger = new Logger(BackupChecksService.name);
  private listing: { value: DriveListing | null; expiresAt: number } | null =
    null;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(BackupCheck.name)
    private readonly checkModel: Model<BackupCheckDocument>,
    @InjectModel(BackupRun.name)
    private readonly runModel: Model<BackupRunDocument>,
    private readonly config: BackupConfig,
    private readonly locator: BackupLocator,
  ) {}

  /** `<live db>_restore` — the only database a test restore may write or drop. */
  testDatabaseName(): string {
    const live = this.connection.db?.databaseName;
    if (!live) throw new Error('MongoDB connection is not ready');
    const slot = `${live}_restore`;
    if (slot === live || !/^[^/\\. "$*<>:|?]{1,63}$/.test(slot)) {
      throw new Error(`Invalid test restore database name: ${slot}`);
    }
    return slot;
  }

  /**
   * Progress callback that saves (done, total) on the check at most every
   * PROGRESS_INTERVAL_MS, and always the final step.
   */
  private progressWriter(checkId: string) {
    let lastWrite = 0;
    return (done: number, total: number) => {
      const now = Date.now();
      if (now - lastWrite < PROGRESS_INTERVAL_MS && done !== total) return;
      lastWrite = now;
      void this.checkModel
        .updateOne({ _id: checkId }, { $set: { progress: { done, total } } })
        .catch(() => undefined);
    };
  }

  // ─── list ──────────────────────────────────────────────────────────────────

  /** Forgets the cached Drive listing (after anything added or deleted files). */
  invalidateListing(): void {
    this.listing = null;
  }

  /**
   * The Drive part of the list (files and manifests), cached briefly: the
   * page polls while checks run, and only their state (MongoDB) changes then.
   */
  private async driveListing(fresh: boolean): Promise<DriveListing | null> {
    if (!fresh && this.listing && this.listing.expiresAt > Date.now()) {
      return this.listing.value;
    }
    const drive = this.locator.drive();
    const folders = await this.locator.folders(drive);
    let value: DriveListing | null = null;
    if (folders) {
      const [made, uploaded, manifests, uploadedManifests] = await Promise.all([
        drive.listFiles(folders.folderId, BACKUP_KIND_VALUE),
        folders.manualFolderId
          ? drive.listFiles(folders.manualFolderId, DB_UPLOAD_KIND)
          : Promise.resolve([] as DriveFile[]),
        drive.listFiles(folders.folderId, MANIFEST_KIND),
        folders.manualFolderId
          ? drive.listFiles(folders.manualFolderId, MANIFEST_UPLOAD_KIND)
          : Promise.resolve([] as DriveFile[]),
      ]);
      value = { made, uploaded, manifests, uploadedManifests };
    }
    this.listing = { value, expiresAt: Date.now() + LISTING_TTL_MS };
    return value;
  }

  /** Database backups in Drive (server-made and uploaded), newest first. */
  async listBackups(opts: { fresh?: boolean } = {}): Promise<BackupListItem[]> {
    const listing = await this.driveListing(!!opts.fresh);
    if (!listing) return [];
    const { made, uploaded, manifests, uploadedManifests } = listing;
    const manifestIds = new Set(
      manifests.map((m) => m.appProperties?.sgbkBackupId),
    );
    const uploadedManifestIds = new Set(
      uploadedManifests.map((m) => m.appProperties?.sgbkBackupId),
    );

    const files = [
      ...made.map((f) => ({ f, uploaded: false })),
      ...uploaded.map((f) => ({ f, uploaded: true })),
    ];
    const backupIds = files
      .map(({ f }) => f.appProperties?.sgbkBackupId)
      .filter((id): id is string => !!id);
    const runs = new Map(
      (
        await this.runModel
          .find({
            kind: 'backup',
            status: 'succeeded',
            backupId: { $in: backupIds },
          })
          .lean()
      ).map((r) => [r.backupId, r]),
    );
    const checks = new Map<string, BackupCheck>();
    for (const c of await this.checkModel
      .find({
        kind: 'verify',
        driveFileId: { $in: files.map(({ f }) => f.id) },
      })
      .sort({ createdAt: -1 })
      .lean()) {
      if (c.driveFileId && !checks.has(c.driveFileId)) {
        checks.set(c.driveFileId, c);
      }
    }

    return files
      .map(({ f, uploaded: isUpload }) => {
        const backupId = f.appProperties?.sgbkBackupId ?? f.name;
        const run = runs.get(backupId);
        const check = checks.get(f.id);
        const source: BackupSource = isUpload
          ? 'uploaded'
          : (run?.trigger ?? 'unknown');
        return {
          fileId: f.id,
          backupId,
          name: f.name,
          source,
          createdAt: f.appProperties?.sgbkCreatedAt ?? f.createdTime ?? null,
          sizeBytes: f.size != null ? Number(f.size) : null,
          totalDocs: isUpload ? null : (run?.totalDocs ?? null),
          hasUploads: isUpload
            ? uploadedManifestIds.has(backupId)
            : manifestIds.has(backupId),
          uploadedFiles: isUpload ? null : (run?.uploads?.files ?? null),
          verification: check
            ? {
                status: check.status,
                trigger: check.trigger,
                at: check.finishedAt ?? check.startedAt,
                error: check.error,
              }
            : null,
          at: backupTimestamp(f) ?? 0,
        };
      })
      .sort((a, b) => b.at - a.at)
      .map(({ at: _at, ...item }) => item); // eslint-disable-line @typescript-eslint/no-unused-vars
  }

  // ─── records ───────────────────────────────────────────────────────────────

  async createCheck(params: {
    kind: BackupCheckKind;
    fileId?: string;
    backupId?: string;
    trigger: 'auto' | 'manual';
    requestedBy?: string;
    mode?: RestoreUploadsMode;
  }): Promise<string> {
    const doc = await this.checkModel.create({
      kind: params.kind,
      status: 'queued',
      driveFileId: params.fileId ?? null,
      backupId: params.backupId ?? null,
      trigger: params.trigger,
      requestedBy: params.requestedBy ?? null,
      mode: params.mode ?? null,
    });
    return String(doc._id);
  }

  /** Removes a check that never got a job (duplicate request). */
  async deleteCheck(checkId: string) {
    await this.checkModel.deleteOne({ _id: checkId });
  }

  /**
   * Fails checks still "queued" or "running" after `maxAgeMs` — their job or
   * background upload died with a restart or crash, and nothing else would
   * ever finish them (the panel would wait forever). Returns how many.
   */
  async failStale(maxAgeMs: number, now = new Date()): Promise<number> {
    const res = await this.checkModel.updateMany(
      {
        status: { $in: ['queued', 'running'] },
        createdAt: { $lt: new Date(now.getTime() - maxAgeMs) },
      },
      {
        $set: {
          status: 'failed',
          error: 'Interrupted (server restart or crash); start it again.',
          finishedAt: now,
        },
      },
    );
    return res.modifiedCount ?? 0;
  }

  async attachJob(checkId: string, jobId: string | undefined) {
    await this.checkModel.updateOne(
      { _id: checkId },
      { $set: { jobId: jobId ?? null } },
    );
  }

  async markFailed(checkId: string, error: unknown) {
    await this.checkModel
      .updateOne(
        { _id: checkId },
        {
          $set: {
            status: 'failed',
            error: sanitizeError(error),
            finishedAt: new Date(),
          },
        },
      )
      .catch(() => undefined);
  }

  async markRunning(checkId: string) {
    await this.checkModel.updateOne(
      { _id: checkId },
      { $set: { status: 'running', startedAt: new Date(), error: null } },
    );
  }

  async markSucceeded(
    checkId: string,
    data: { driveFileId?: string; report: Record<string, unknown> },
  ) {
    await this.checkModel.updateOne(
      { _id: checkId },
      {
        $set: {
          status: 'succeeded',
          finishedAt: new Date(),
          report: data.report,
          ...(data.driveFileId && { driveFileId: data.driveFileId }),
        },
      },
    );
  }

  async getCheck(checkId: string) {
    if (!Types.ObjectId.isValid(checkId)) return null;
    return this.checkModel.findById(checkId).lean();
  }

  // ─── verify ────────────────────────────────────────────────────────────────

  /**
   * Decrypts and validates the whole database file from Drive, then checks
   * its uploads (deep: every blob decrypted; light: every blob present).
   * Stores the outcome on the check record; never throws for a bad backup
   * (returns status 'failed'), only for infrastructure errors.
   */
  async verify(
    checkId: string,
    fileId: string,
    opts: {
      deepUploads: boolean;
      signal?: AbortSignal;
      /**
       * The file as just uploaded: read instead of downloading it again, but
       * only if Drive reports the same MD5 (so it is the very same bytes).
       */
      localCopy?: { path: string; md5: string };
      /** Blob ids known to be in Drive (light check: skips listing them). */
      knownBlobs?: Set<string>;
    },
  ): Promise<BackupCheck['status']> {
    const startedAt = new Date();
    await this.checkModel.updateOne(
      { _id: checkId },
      { $set: { status: 'running', startedAt, error: null } },
    );
    const drive = this.locator.drive();
    const keys = this.config.decryptionKeys();
    let resolved: ResolvedBackupFile | null = null;
    try {
      const file = await this.locator.resolveDbFile(drive, fileId);
      resolved = file;
      const local =
        opts.localCopy && file.file.md5Checksum === opts.localCopy.md5
          ? opts.localCopy.path
          : null;
      const verified = await verifyBackupSource(
        () =>
          local
            ? createReadStream(local)
            : drive.downloadFile(file.file.id, opts.signal),
        keys,
      );
      const uploads = await this.verifyUploadsOf(
        drive,
        resolved,
        keys,
        opts.deepUploads,
        opts.signal,
        opts.deepUploads ? undefined : opts.knownBlobs,
      );
      const problems = uploads
        ? uploads.missing.length + uploads.corrupt.length
        : 0;
      const status = problems ? 'failed' : 'succeeded';
      await this.checkModel.updateOne(
        { _id: checkId },
        {
          $set: {
            status,
            backupId: verified.header.backupId,
            finishedAt: new Date(),
            error: problems
              ? `Uploaded files: ${uploads!.missing.length} missing, ${uploads!.corrupt.length} corrupt`
              : null,
            report: {
              backupId: verified.header.backupId,
              createdAt: verified.header.createdAt,
              sourceDb: verified.header.sourceDb,
              keyId: verified.header.keyId,
              consistency: verified.begin.consistency,
              totalDocs: verified.end.totalDocs,
              collections: verified.counts,
              /** Where the database file was read: Drive, or the MD5-matched upload copy. */
              readFrom: local ? 'local-copy' : 'drive',
              uploads: uploads
                ? {
                    files: uploads.files,
                    totalBytes: uploads.totalBytes,
                    deep: uploads.deep,
                    missing: uploads.missing.slice(0, 50),
                    corrupt: uploads.corrupt.slice(0, 50),
                  }
                : null,
            },
          },
        },
      );
      await this.recordVerification(drive, resolved, status);
      this.logger.log(
        `Verification of backup ${verified.header.backupId}: ${status}` +
          (problems ? ` (${problems} upload problems)` : ''),
      );
      return status;
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      // A corrupt/tampered/unreadable backup is a result, not a job failure.
      await this.markFailed(checkId, err);
      if (resolved && err instanceof BackupFormatError) {
        await this.recordVerification(drive, resolved, 'failed');
      }
      this.logger.warn(
        `Verification of ${fileId} failed: ${sanitizeError(err)}`,
      );
      return 'failed';
    }
  }

  /**
   * Notes the outcome on a server-made backup file, for retention (which
   * keeps enough backups that did not fail and the last one that passed).
   * Best effort: the check record stays the source of truth for the UI.
   */
  private async recordVerification(
    drive: GoogleDriveClient,
    resolved: ResolvedBackupFile,
    status: BackupCheck['status'],
  ): Promise<void> {
    if (resolved.uploaded) return;
    try {
      await drive.setAppProperties(resolved.file.id, {
        [BACKUP_VERIFIED_PROPERTY]: status === 'succeeded' ? 'ok' : 'failed',
      });
    } catch (err) {
      this.logger.warn(
        `Could not record the verification on ${resolved.file.id}: ${sanitizeError(err)}`,
      );
    }
  }

  private async verifyUploadsOf(
    drive: GoogleDriveClient,
    resolved: ResolvedBackupFile,
    keys: Buffer[],
    deep: boolean,
    signal?: AbortSignal,
    knownBlobs?: Set<string>,
  ): Promise<UploadsVerifyReport | null> {
    const manifest = await this.locator.findManifest(drive, resolved);
    if (!manifest) return null;
    const source: UploadsSource = knownBlobs
      ? {
          backupId: manifest.appProperties?.sgbkBackupId ?? manifest.name,
          openManifest: () => drive.downloadFile(manifest.id),
          hasBlob: (id) => knownBlobs.has(id),
          openBlob: () => Promise.resolve(null), // light check: presence only
        }
      : await driveUploadsSource({
          drive,
          manifest,
          backupFolderId: resolved.folders.folderId,
        });
    return verifyUploads({ source, keys, deep, signal });
  }

  // ─── test restore ──────────────────────────────────────────────────────────

  /**
   * Restores a backup into `<live>_restore` (replacing any previous test
   * copy) and compares it with the live database. Pass 1 verifies the whole
   * file before the slot is touched; a failed pass 2 drops the partial slot.
   */
  async testRestore(
    checkId: string,
    fileId: string,
    opts: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const startedAt = new Date();
    await this.checkModel.updateOne(
      { _id: checkId },
      { $set: { status: 'running', startedAt, error: null } },
    );
    const slotName = this.testDatabaseName();
    const liveDb = this.connection.db!;
    const keys = this.config.decryptionKeys();
    const drive = this.locator.drive();
    let slotTouched = false;

    try {
      const limit = this.config.testRestoreMaxBytes;
      if (limit) {
        const stats = (await liveDb.stats()) as { dataSize?: number };
        if ((stats.dataSize ?? 0) > limit) {
          throw new BadRequestException(
            `The live database (${Math.round((stats.dataSize ?? 0) / 1048576)} MB) is larger than BACKUP_TEST_RESTORE_MAX_MB; a test copy could exceed the cluster's storage.`,
          );
        }
      }

      const resolved = await this.locator.resolveDbFile(drive, fileId);
      const open = () => drive.downloadFile(resolved.file.id, opts.signal);
      const verified = await verifyBackupSource(open, keys);

      const slot = this.connection.getClient().db(slotName);
      // Never replace a database an API instance has run on (e.g. after
      // someone switched MONGODB_DB_NAME to it).
      await assertNotLiveDatabase(slot, 'replace');
      slotTouched = true;
      await slot.dropDatabase();
      // Earlier test restores are gone now.
      await this.checkModel.updateMany(
        { kind: 'test-restore', _id: { $ne: checkId }, dropped: false },
        { $set: { dropped: true } },
      );

      const report = await restoreIntoDatabase({
        db: slot,
        source: open,
        keys,
        verified,
        onProgress: this.progressWriter(checkId),
      });

      const comparison: ComparisonRow[] = [];
      const liveNames = new Set(
        (await liveDb.listCollections({}, { nameOnly: true }).toArray())
          .map((c) => c.name)
          .filter((n) => !n.startsWith('system.') && !isInternalCollection(n)),
      );
      for (const [collection, c] of Object.entries(report.collections)) {
        comparison.push({
          collection,
          backup: c.expected,
          restored: c.restored,
          live: liveNames.has(collection)
            ? await liveDb.collection(collection).countDocuments()
            : null,
        });
        liveNames.delete(collection);
      }
      // Collections that exist now but not in the backup.
      for (const collection of liveNames) {
        comparison.push({
          collection,
          backup: 0,
          restored: 0,
          live: await liveDb.collection(collection).countDocuments(),
        });
      }
      comparison.sort((a, b) => a.collection.localeCompare(b.collection));

      await this.checkModel.updateOne(
        { _id: checkId },
        {
          $set: {
            status: 'succeeded',
            backupId: report.backupId,
            finishedAt: new Date(),
            progress: { done: report.totalDocs, total: report.totalDocs },
            report: {
              backupId: report.backupId,
              createdAt: report.createdAt,
              dbName: slotName,
              totalDocs: report.totalDocs,
              views: report.views,
              indexes: Object.values(report.indexes).reduce((a, b) => a + b, 0),
              comparison,
            },
          },
        },
      );
      this.logger.log(
        `Test restore of backup ${report.backupId} into "${slotName}" succeeded (${report.totalDocs} documents)`,
      );
    } catch (err) {
      if (slotTouched) {
        await this.connection
          .getClient()
          .db(slotName)
          .dropDatabase()
          .catch(() => undefined);
      }
      await this.markFailed(checkId, err);
      this.logger.warn(
        `Test restore of ${fileId} failed: ${sanitizeError(err)}`,
      );
      if (opts.signal?.aborted) throw err;
    }
  }

  /** The latest test restore and whether its database still exists. */
  async getTestRestore() {
    const latest = await this.checkModel
      .findOne({ kind: 'test-restore' })
      .sort({ createdAt: -1 })
      .lean();
    const slotName = this.testDatabaseName();
    const slot = this.connection.getClient().db(slotName);
    const collections = await slot
      .listCollections({}, { nameOnly: true })
      .toArray();
    return {
      dbName: slotName,
      exists: collections.length > 0,
      /** An API instance has run on this database: it must not be dropped here. */
      inUseAsLive: collections.length > 0 && !!(await liveMarkerOf(slot)),
      latest,
    };
  }

  /**
   * Drops the test database once its latest restore is older than `maxAgeMs`
   * (it holds a full copy of the store's data, personal data included, and
   * uses cluster space). Not while a test restore is queued or running, and
   * never a database an API instance has run on. True if dropped.
   */
  async dropExpiredTestDatabase(maxAgeMs: number, now = new Date()) {
    const latest = await this.checkModel
      .findOne({ kind: 'test-restore' })
      .sort({ createdAt: -1 })
      .lean();
    if (
      !latest ||
      latest.status !== 'succeeded' ||
      latest.dropped ||
      !latest.finishedAt ||
      now.getTime() - latest.finishedAt.getTime() < maxAgeMs
    ) {
      return false;
    }
    const slot = this.connection.getClient().db(this.testDatabaseName());
    if (await liveMarkerOf(slot)) return false;
    await this.dropTestDatabase();
    return true;
  }

  /** Drops `<live>_restore` (only that database). */
  async dropTestDatabase(): Promise<{ dbName: string }> {
    const slotName = this.testDatabaseName();
    const slot = this.connection.getClient().db(slotName);
    try {
      await assertNotLiveDatabase(slot, 'drop');
    } catch (err) {
      throw new ConflictException((err as Error).message);
    }
    await slot.dropDatabase();
    await this.checkModel.updateMany(
      { kind: 'test-restore', dropped: false },
      { $set: { dropped: true } },
    );
    this.logger.log(`Test restore database "${slotName}" dropped`);
    return { dbName: slotName };
  }

  // ─── restore uploaded files into the live folder ─────────────────────────────

  /** The live uploads folder (UPLOADS_ROOT). Overridable for tests. */
  uploadsRoot(): string {
    return getUploadsRoot();
  }

  /**
   * Restores a backup's uploaded files into the live uploads folder.
   * Every file is decrypted and checked against its id before it is
   * written (atomically); identical files are skipped; a different existing
   * file is only replaced in 'overwrite' mode; nothing is ever deleted.
   * 'preview' writes nothing. Conflicts are a result, not a failure;
   * files missing from Drive fail the check.
   */
  async restoreUploadedFiles(
    checkId: string,
    fileId: string,
    mode: RestoreUploadsMode,
    opts: { signal?: AbortSignal } = {},
  ): Promise<void> {
    await this.checkModel.updateOne(
      { _id: checkId },
      { $set: { status: 'running', startedAt: new Date(), error: null } },
    );
    const drive = this.locator.drive();
    const keys = this.config.decryptionKeys();
    try {
      const resolved = await this.locator.resolveDbFile(drive, fileId);
      const manifest = await this.locator.findManifest(drive, resolved);
      if (!manifest) {
        throw new BadRequestException(
          'This backup has no uploaded files to restore',
        );
      }
      const source = await driveUploadsSource({
        drive,
        manifest,
        backupFolderId: resolved.folders.folderId,
      });

      let report: UploadsRestoreReport;
      try {
        report = await restoreUploads({
          source,
          keys,
          targetDir: this.uploadsRoot(),
          dryRun: mode === 'preview',
          overwrite: mode === 'overwrite',
          signal: opts.signal,
          onProgress: this.progressWriter(checkId),
        });
      } catch (err) {
        // Conflicts / missing files come back as a report, not a crash.
        if (!(err instanceof UploadsRestoreError) || !err.report) throw err;
        report = err.report;
      }

      const failed = report.missing.length + report.failed.length > 0;
      await this.checkModel.updateOne(
        { _id: checkId },
        {
          $set: {
            status: failed ? 'failed' : 'succeeded',
            backupId: resolved.backupId,
            finishedAt: new Date(),
            progress: { done: report.files, total: report.files },
            error: failed
              ? [
                  report.missing.length &&
                    `${report.missing.length} file(s) are missing from Google Drive`,
                  report.failed.length &&
                    `${report.failed.length} file(s) could not be restored (corrupt or unreadable)`,
                ]
                  .filter(Boolean)
                  .join('; ')
              : null,
            report: {
              mode,
              backupId: report.backupId,
              createdAt: report.createdAt,
              files: report.files,
              restored: report.restored,
              unchanged: report.unchanged,
              conflictsCount: report.conflicts.length,
              conflicts: report.conflicts.slice(0, 200),
              missingCount: report.missing.length,
              missing: report.missing.slice(0, 200),
              failedCount: report.failed.length,
              failed: report.failed.slice(0, 200),
              dryRun: report.dryRun,
            },
          },
        },
      );
      this.logger.log(
        `Uploads restore (${mode}) of backup ${resolved.backupId}: ${report.restored} ${
          mode === 'preview' ? 'would be written' : 'written'
        }, ${report.unchanged} unchanged, ${report.conflicts.length} conflicts, ${report.missing.length} missing`,
      );
    } catch (err) {
      await this.markFailed(checkId, err);
      this.logger.warn(
        `Uploads restore of ${fileId} failed: ${sanitizeError(err)}`,
      );
      if (opts.signal?.aborted) throw err;
    }
  }
}
