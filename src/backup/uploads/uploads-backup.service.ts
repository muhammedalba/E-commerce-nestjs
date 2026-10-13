import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createReadStream, existsSync } from 'fs';
import { Model } from 'mongoose';
import { Readable } from 'stream';
import { getUploadsRoot } from 'src/shared/utils/upload-path.util';
import { backupKeyId } from '../backup-format';
import {
  MANIFEST_UPLOAD_KIND,
  MANUAL_UPLOADS_FOLDER_NAME,
  MANUAL_UPLOADS_FOLDER_ROLE,
  sanitizeError,
} from '../backup.types';
import { DriveFile, GoogleDriveClient } from '../google-drive.client';
import { BACKUP_CREATED_AT_PROPERTY, BACKUP_KIND_PROPERTY } from '../retention';
import {
  BLOB_ID_PROPERTY,
  BLOB_KIND,
  MANIFEST_KIND,
  MAX_UPLOAD_FILE_BYTES,
  UPLOADS_MANIFEST_VERSION,
  UploadsManifest,
  assertSafeRelativePath,
  hashFile,
  listLocalUploads,
  openPayload,
  parseManifest,
  sealBlobStream,
  sealPayload,
} from './uploads-format';
import {
  BackupUploadIndex,
  BackupUploadIndexDocument,
  BackupUploadManifest,
  BackupUploadManifestDocument,
} from './uploads.schemas';
import { loadBlobIndex } from './blob-index';

export interface UploadsBackupResult {
  manifestId: string;
  files: number;
  totalBytes: number;
  uploadedBlobs: number;
  reusedBlobs: number;
  /** Files left out because they exceed MAX_UPLOAD_FILE_BYTES (paths). */
  skippedTooLarge: string[];
}

/** {@link UploadsBackupResult} plus what the caller may reuse in this run. */
export interface UploadsBackupOutcome extends UploadsBackupResult {
  /** Every blob id known to be in Drive after this backup (not stored). */
  blobIds: string[];
}

/**
 * Uploaded files hashed/uploaded at once. Each upload is mostly waiting on
 * Drive, so a few in parallel cut the time of a first backup (or of many
 * new images) several times; more would only hit Drive's rate limits.
 */
const UPLOAD_CONCURRENCY = 4;

/** Runs `fn` over `items` with at most `limit` at a time; results keep the input order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

/** A file that changed while it was being uploaded is re-read this many times. */
const CHANGED_FILE_RETRIES = 2;

export interface UploadsPruneResult {
  manifestsDeleted: number;
  blobsDeleted: number;
  failed: number;
  /** Blob cleanup is skipped (never guessed) when a manifest is unreadable. */
  blobCleanupSkipped: boolean;
}

/** Blobs younger than this are never garbage-collected (in-flight safety). */
const BLOB_GC_GRACE_MS = 24 * 60 * 60 * 1000;
const BACKUP_ID_PROPERTY = 'sgbkBackupId';

type Drive = Pick<
  GoogleDriveClient,
  | 'ensureFolder'
  | 'findFolders'
  | 'listFiles'
  | 'listBackups'
  | 'uploadResumable'
  | 'downloadFile'
  | 'deleteFile'
>;

/**
 * Incremental, encrypted backup of the local uploads folder (product images,
 * order attachments, …) next to each database backup. See uploads-format.ts.
 */
@Injectable()
export class UploadsBackupService {
  private readonly logger = new Logger(UploadsBackupService.name);

  constructor(
    @InjectModel(BackupUploadIndex.name)
    private readonly indexModel: Model<BackupUploadIndexDocument>,
    @InjectModel(BackupUploadManifest.name)
    private readonly manifestModel: Model<BackupUploadManifestDocument>,
  ) {}

  /** Overridable for tests. */
  uploadsRoot(): string {
    return getUploadsRoot();
  }

  /** Overridable for tests. */
  maxFileBytes(): number {
    return MAX_UPLOAD_FILE_BYTES;
  }

  /**
   * Uploads the blobs Drive does not have yet, then the manifest of this
   * backup. Returns null when there is no local uploads folder (e.g. all
   * media on Cloudinary). Throws on any failure — a backup is only complete
   * with its manifest.
   */
  async backup(params: {
    drive: Drive;
    folderId: string;
    backupId: string;
    createdAt: Date;
    sourceDb: string;
    key: Buffer;
    signal?: AbortSignal;
  }): Promise<UploadsBackupOutcome | null> {
    const { drive, key, signal } = params;
    const root = this.uploadsRoot();
    if (!existsSync(root)) {
      this.logger.log(`No local uploads folder at ${root}; nothing to back up`);
      return null;
    }
    const keyId = backupKeyId(key);
    const skippedTooLarge: string[] = [];
    const local = (await listLocalUploads(root)).filter((f) => {
      assertSafeRelativePath(f.rel);
      const max = this.maxFileBytes();
      if (f.size <= max) return true;
      // One huge file must not stop every backup (database included).
      skippedTooLarge.push(f.rel);
      this.logger.warn(
        `Uploaded file left out of the backup (${f.size} bytes > ${max}): ${f.rel}`,
      );
      return false;
    });

    const blobIndex = await loadBlobIndex(drive, params.folderId, {
      create: true,
    });
    const blobsFolderId = blobIndex.folderId!;
    const inDrive = new Set(blobIndex.files.keys());
    const cached = new Map(
      (await this.indexModel.find({}).lean()).map((d) => [d.path, d]),
    );

    const manifest: UploadsManifest = {
      formatVersion: UPLOADS_MANIFEST_VERSION,
      backupId: params.backupId,
      createdAt: params.createdAt.toISOString(),
      files: [],
      totalBytes: 0,
    };
    let uploadedBlobs = 0;
    let reusedBlobs = 0;
    /** Blob uploads in flight, so two files with the same content upload once. */
    const uploading = new Map<
      string,
      Promise<{ blob: string; size: number }>
    >();

    const entries = await mapLimit(local, UPLOAD_CONCURRENCY, async (file) => {
      signal?.throwIfAborted();
      const hit = cached.get(file.rel);
      let blob =
        hit &&
        hit.size === file.size &&
        hit.mtimeMs === file.mtimeMs &&
        hit.keyId === keyId
          ? hit.blob
          : null;
      // The size of the bytes the id was computed over (the file may have
      // changed since it was listed).
      let size = file.size;

      if (!blob || !inDrive.has(blob)) {
        ({ id: blob, size } = await hashFile(key, file.abs));
      }
      const pending = uploading.get(blob);
      const same = pending && (await pending);
      if (same && same.blob === blob) {
        reusedBlobs++; // another file with this content was just uploaded
      } else if (!inDrive.has(blob)) {
        const upload = this.uploadBlob(drive, blobsFolderId, file.abs, blob, {
          key,
          createdAt: params.createdAt,
          sourceDb: params.sourceDb,
          signal,
        });
        uploading.set(blob, upload);
        ({ blob, size } = await upload);
        inDrive.add(blob);
        uploadedBlobs++;
      } else {
        reusedBlobs++;
      }
      if (!hit || hit.blob !== blob || hit.mtimeMs !== file.mtimeMs) {
        await this.indexModel.updateOne(
          { path: file.rel },
          { $set: { size, mtimeMs: file.mtimeMs, blob, keyId } },
          { upsert: true },
        );
      }
      return {
        path: file.rel,
        blob,
        size,
        mtime: new Date(file.mtimeMs).toISOString(),
      };
    });
    manifest.files = entries; // same order as `local` (sorted by path)
    manifest.totalBytes = entries.reduce((sum, e) => sum + e.size, 0);
    // Forget cache entries of files that no longer exist.
    await this.indexModel.deleteMany({
      path: { $nin: local.map((f) => f.rel) },
    });

    signal?.throwIfAborted();
    const sealedManifest = await sealPayload({
      key,
      payload: 'upload-manifest',
      id: params.backupId,
      createdAt: params.createdAt,
      sourceDb: params.sourceDb,
      data: Buffer.from(JSON.stringify(manifest), 'utf8'),
    });
    const uploaded = await drive.uploadResumable(
      Readable.from([sealedManifest]),
      {
        name: `skygalaxy-${params.backupId}.uploads.sgbk`,
        folderId: params.folderId,
        appProperties: {
          [BACKUP_KIND_PROPERTY]: MANIFEST_KIND,
          [BACKUP_ID_PROPERTY]: params.backupId,
          [BACKUP_CREATED_AT_PROPERTY]: params.createdAt.toISOString(),
        },
        signal,
      },
    );
    await this.manifestModel.updateOne(
      { driveFileId: uploaded.id },
      {
        $set: {
          backupId: params.backupId,
          blobs: [...new Set(manifest.files.map((f) => f.blob))],
        },
      },
      { upsert: true },
    );

    this.logger.log(
      `Uploads backup ${params.backupId}: ${local.length} files, ${manifest.totalBytes} bytes, ` +
        `${uploadedBlobs} new blobs uploaded, ${reusedBlobs} unchanged` +
        (skippedTooLarge.length
          ? `, ${skippedTooLarge.length} too large (left out)`
          : ''),
    );
    return {
      manifestId: uploaded.id,
      files: local.length,
      totalBytes: manifest.totalBytes,
      uploadedBlobs,
      reusedBlobs,
      skippedTooLarge,
      blobIds: [...inDrive],
    };
  }

  /**
   * Streams one file into Drive as a blob named by its id. If the file
   * changed between hashing and sealing, the sealed bytes would not match
   * the name: that upload is deleted and the file re-read. Returns the id
   * the blob was stored under and the size of what was sealed.
   */
  private async uploadBlob(
    drive: Drive,
    folderId: string,
    file: string,
    blob: string,
    ctx: {
      key: Buffer;
      createdAt: Date;
      sourceDb: string;
      signal?: AbortSignal;
    },
  ): Promise<{ blob: string; size: number }> {
    for (let attempt = 0; ; attempt++) {
      const sealed = sealBlobStream({
        key: ctx.key,
        id: blob,
        createdAt: ctx.createdAt,
        sourceDb: ctx.sourceDb,
        source: createReadStream(file),
      });
      const uploaded = await drive.uploadResumable(sealed.stream, {
        name: `${blob}.sgbk`,
        folderId,
        appProperties: {
          [BACKUP_KIND_PROPERTY]: BLOB_KIND,
          [BLOB_ID_PROPERTY]: blob,
        },
        signal: ctx.signal,
      });
      if (sealed.digest() === blob) return { blob, size: sealed.size() };
      await drive.deleteFile(uploaded.id).catch(() => undefined);
      if (attempt >= CHANGED_FILE_RETRIES) {
        throw new Error(`Uploaded file kept changing while backed up: ${file}`);
      }
      blob = (await hashFile(ctx.key, file)).id;
    }
  }

  /**
   * Runs after database retention: deletes manifests whose database backup
   * is gone, then blobs no remaining manifest references (and older than a
   * day). Conservative: if any remaining manifest cannot be read, no blob is
   * deleted. Failures are counted, never thrown per file.
   */
  async prune(params: {
    drive: Drive;
    folderId: string;
    keys: Buffer[];
    now?: Date;
  }): Promise<UploadsPruneResult> {
    const { drive, folderId } = params;
    const now = (params.now ?? new Date()).getTime();
    const result: UploadsPruneResult = {
      manifestsDeleted: 0,
      blobsDeleted: 0,
      failed: 0,
      blobCleanupSkipped: false,
    };

    const dbBackups = await drive.listBackups(folderId);
    if (dbBackups.length === 0) {
      // Never prune uploads against an empty (or unreadable) backup list.
      result.blobCleanupSkipped = true;
      return result;
    }
    const keep = new Set(
      dbBackups
        .map((f) => f.appProperties?.[BACKUP_ID_PROPERTY])
        .filter((id): id is string => !!id),
    );

    const manifests = await drive.listFiles(folderId, MANIFEST_KIND);
    const remaining: DriveFile[] = [];
    for (const m of manifests) {
      const backupId = m.appProperties?.[BACKUP_ID_PROPERTY];
      if (backupId && keep.has(backupId)) {
        remaining.push(m);
        continue;
      }
      try {
        await drive.deleteFile(m.id);
        await this.manifestModel.deleteOne({ driveFileId: m.id });
        result.manifestsDeleted++;
      } catch (err) {
        result.failed++;
        remaining.push(m); // still there: its blobs stay referenced
        this.logger.warn(
          `Could not delete uploads manifest ${m.name}: ${sanitizeError(err)}`,
        );
      }
    }

    // Bundles uploaded from a device share the blobs folder; their manifests
    // (never pruned here) keep their blobs alive too.
    const [manualFolder] = await drive.findFolders(MANUAL_UPLOADS_FOLDER_NAME, {
      role: MANUAL_UPLOADS_FOLDER_ROLE,
      parentId: folderId,
    });
    if (manualFolder) {
      remaining.push(
        ...(await drive.listFiles(manualFolder.id, MANIFEST_UPLOAD_KIND)),
      );
    }

    const referenced = new Set<string>();
    for (const m of remaining) {
      const blobs = await this.manifestBlobs(drive, m, params.keys);
      if (!blobs) {
        result.blobCleanupSkipped = true;
        this.logger.warn(
          `Uploads manifest ${m.name} is unreadable; skipping blob cleanup`,
        );
        return result;
      }
      blobs.forEach((b) => referenced.add(b));
    }

    for (const [id, blob] of (await loadBlobIndex(drive, folderId)).files) {
      const age = now - Date.parse(blob.createdTime ?? '');
      if (referenced.has(id) || !(age > BLOB_GC_GRACE_MS)) continue;
      try {
        await drive.deleteFile(blob.id);
        result.blobsDeleted++;
      } catch (err) {
        result.failed++;
        this.logger.warn(
          `Could not delete upload blob ${blob.name}: ${sanitizeError(err)}`,
        );
      }
    }
    if (result.manifestsDeleted || result.blobsDeleted) {
      this.logger.log(
        `Uploads retention: ${result.manifestsDeleted} manifests and ${result.blobsDeleted} blobs deleted`,
      );
    }
    return result;
  }

  /** Blob ids of a manifest: cached in Mongo, else downloaded and decrypted. */
  private async manifestBlobs(
    drive: Drive,
    file: DriveFile,
    keys: Buffer[],
  ): Promise<string[] | null> {
    const cached = await this.manifestModel
      .findOne({ driveFileId: file.id })
      .lean();
    if (cached) return cached.blobs;
    try {
      const { data } = await openPayload(
        await drive.downloadFile(file.id),
        keys,
        'upload-manifest',
      );
      const manifest = parseManifest(data);
      const blobs = [...new Set(manifest.files.map((f) => f.blob))];
      await this.manifestModel.updateOne(
        { driveFileId: file.id },
        { $set: { backupId: manifest.backupId, blobs } },
        { upsert: true },
      );
      return blobs;
    } catch (err) {
      this.logger.warn(
        `Reading uploads manifest ${file.name} failed: ${sanitizeError(err)}`,
      );
      return null;
    }
  }
}
