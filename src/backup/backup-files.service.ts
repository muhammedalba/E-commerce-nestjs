import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Redis } from 'ioredis';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { REDIS_CLIENT, redisNamespace } from 'src/shared/redis/redis.module';
import {
  BackupFileHeader,
  backupKeyId,
  payloadOf,
  tryParseHeaderPrefix,
  MAX_HEADER_BYTES,
} from './backup-format';
import { BackupConfig } from './backup.config';
import { BackupLocator } from './backup-locator';
import { BackupLocks } from './backup.locks';
import {
  DB_UPLOAD_KIND,
  MANIFEST_UPLOAD_KIND,
  sanitizeError,
} from './backup.types';
import {
  BACKUP_ID_PATTERN,
  blobEntryName,
  bundleFileName,
  bundleReadme,
  dbEntryName,
  looksLikeTar,
  manifestEntryName,
  openEntry,
  readBundle,
  readHead,
  README_ENTRY,
} from './bundle/bundle';
import {
  TarEntrySource,
  TarFormatError,
  tarSize,
  writeTar,
} from './bundle/tar';
import { DriveFile, GoogleDriveClient } from './google-drive.client';
import { BACKUP_CREATED_AT_PROPERTY, BACKUP_KIND_PROPERTY } from './retention';
import {
  BLOB_ID_PROPERTY,
  BLOB_KIND,
  checkBlobStream,
  openPayload,
  parseManifest,
} from './uploads/uploads-format';
import { loadBlobIndex } from './uploads/blob-index';

const LINK_TTL_MS = 60_000;

/** Atomically reads and deletes a key (single-use tokens; GETDEL-compatible). */
const TAKE_SCRIPT = `
local v = redis.call('get', KEYS[1])
if v then redis.call('del', KEYS[1]) end
return v`;

export interface PreparedBundle {
  fileName: string;
  size: number;
  entries: TarEntrySource[];
}

/** An uploaded temp file whose header (and bundle layout) passed the checks. */
export interface InspectedUpload {
  tempPath: string;
  isBundle: boolean;
  bundle: Awaited<ReturnType<typeof readBundle>> | null;
  header: BackupFileHeader;
}

/** How long a background import waits for a running backup/check. */
const IMPORT_LOCK_WAIT_MS = 15 * 60_000;

export interface ImportResult {
  fileId: string;
  backupId: string;
  format: 'file' | 'bundle';
  uploadedFiles: number;
  uploadedBlobs: number;
}

const md5Of = async (src: Readable): Promise<string> => {
  const hash = createHash('md5');
  for await (const chunk of src) hash.update(chunk as Buffer);
  return hash.digest('hex');
};

/** Reads just enough of a stream to parse the SGBK header, then stops. */
async function readHeader(src: Readable): Promise<BackupFileHeader> {
  let buf = Buffer.alloc(0);
  try {
    for await (const chunk of src) {
      buf = Buffer.concat([buf, chunk as Buffer]);
      const parsed = tryParseHeaderPrefix(buf);
      if (parsed) return parsed.header;
      if (buf.length > MAX_HEADER_BYTES + 16) break;
    }
  } finally {
    src.destroy();
  }
  throw new BadRequestException('Not a valid backup file (incomplete header)');
}

/**
 * Downloads (as an encrypted bundle: DB + its uploaded files) and uploads of
 * backups from the admin panel. Nothing here decrypts data to disk; uploads
 * are checked (header, key, blob integrity) before anything reaches Drive.
 */
@Injectable()
export class BackupFilesService {
  private readonly logger = new Logger(BackupFilesService.name);
  private readonly ns: string;

  constructor(
    private readonly config: BackupConfig,
    private readonly locator: BackupLocator,
    private readonly locks: BackupLocks,
    configService: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {
    this.ns = redisNamespace(configService);
  }

  private tokenKey(token: string) {
    const digest = createHash('sha256').update(token).digest('hex');
    return `${this.ns}:backup-download:${digest}`;
  }

  // ─── download ──────────────────────────────────────────────────────────────

  /**
   * One-time, 60-second link for the browser's own download manager. Only
   * a hash of the token is stored; the token is the credential of the
   * unauthenticated GET, which consumes it.
   */
  async createDownloadLink(fileId: string, userId?: string) {
    const drive = this.locator.drive();
    const resolved = await this.locator.resolveDbFile(drive, fileId);
    if (!this.redis) throw new Error('Redis is required for download links');
    const token = randomBytes(32).toString('base64url');
    await this.redis.set(
      this.tokenKey(token),
      JSON.stringify({ fileId, userId: userId ?? null }),
      'PX',
      LINK_TTL_MS,
    );
    return {
      path: `backup/download/${token}`,
      expiresAt: new Date(Date.now() + LINK_TTL_MS).toISOString(),
      fileName: bundleFileName(resolved.backupId),
      backupId: resolved.backupId,
    };
  }

  async consumeToken(
    token: string,
  ): Promise<{ fileId: string; userId: string | null } | null> {
    if (!this.redis) return null;
    const raw = (await this.redis.eval(
      TAKE_SCRIPT,
      1,
      this.tokenKey(token),
    )) as string | null;
    return raw
      ? (JSON.parse(raw) as { fileId: string; userId: string | null })
      : null;
  }

  /**
   * Lists everything the bundle will contain, with exact sizes, before a
   * byte is sent. A manifest that references a blob missing in Drive makes
   * this throw 409 instead of producing an incomplete bundle.
   */
  async prepareBundle(fileId: string): Promise<PreparedBundle> {
    const drive = this.locator.drive();
    const resolved = await this.locator.resolveDbFile(drive, fileId);
    const { backupId, file } = resolved;
    const manifest = await this.locator.findManifest(drive, resolved);
    const readme = Buffer.from(bundleReadme(backupId, !!manifest), 'utf8');
    const createdAt = new Date(
      file.appProperties?.[BACKUP_CREATED_AT_PROPERTY] ?? Date.now(),
    );
    const fromDrive = (f: DriveFile, name: string): TarEntrySource => ({
      name,
      size: Number(f.size),
      mtime: createdAt,
      open: () => drive.downloadFile(f.id),
    });

    const entries: TarEntrySource[] = [
      {
        name: README_ENTRY,
        size: readme.length,
        mtime: createdAt,
        open: () => [readme],
      },
      fromDrive(file, dbEntryName(backupId)),
    ];

    if (manifest) {
      entries.push(fromDrive(manifest, manifestEntryName(backupId)));
      const { data } = await openPayload(
        await drive.downloadFile(manifest.id),
        this.config.decryptionKeys(),
        'upload-manifest',
      );
      const blobIds = [
        ...new Set(parseManifest(data).files.map((f) => f.blob)),
      ];
      const { files: inDrive } = await loadBlobIndex(
        drive,
        resolved.folders.folderId,
      );
      const missing = blobIds.filter((id) => !inDrive.has(id));
      if (missing.length) {
        throw new ConflictException(
          `${missing.length} uploaded file(s) of this backup are missing from Google Drive; the bundle would be incomplete.`,
        );
      }
      for (const id of blobIds.sort()) {
        entries.push(fromDrive(inDrive.get(id)!, blobEntryName(id)));
      }
    }

    if (entries.some((e) => !Number.isFinite(e.size))) {
      throw new ConflictException('Google Drive did not report a file size');
    }
    return {
      fileName: bundleFileName(backupId),
      size: tarSize(entries),
      entries,
    };
  }

  /** `GET /backup/download/:token`: streams the bundle as an attachment. */
  async streamBundle(token: string, res: Response): Promise<void> {
    const grant = await this.consumeToken(token);
    if (!grant) {
      throw new NotFoundException(
        'This download link is invalid or has expired',
      );
    }
    const bundle = await this.prepareBundle(grant.fileId);
    res.status(200);
    res.setHeader('Content-Type', 'application/x-tar');
    res.setHeader('Content-Length', String(bundle.size));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${bundle.fileName}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    this.logger.log(
      `Streaming backup bundle ${bundle.fileName} (${bundle.size} bytes) to user ${grant.userId ?? 'unknown'}`,
    );
    try {
      await pipeline(Readable.from(writeTar(bundle.entries)), res);
    } catch (err) {
      // Headers are gone: the browser sees an interrupted download.
      this.logger.error(
        `Bundle download ${bundle.fileName} interrupted: ${sanitizeError(err)}`,
      );
      res.destroy();
    }
  }

  // ─── upload ────────────────────────────────────────────────────────────────

  private assertDbHeader(header: BackupFileHeader, keyIds: Set<string>) {
    if (payloadOf(header) !== 'db') {
      throw new BadRequestException(
        'This file is not a database backup (it is an uploaded-files part).',
      );
    }
    if (!keyIds.has(header.keyId)) {
      throw new BadRequestException(
        'This backup was encrypted with a key this server does not have (add it to BACKUP_DECRYPTION_KEYS).',
      );
    }
    if (!BACKUP_ID_PATTERN.test(header.backupId)) {
      throw new BadRequestException('Backup header has an invalid id');
    }
  }

  /**
   * Imports a `.sgbk` database file or a `.backup.tar` bundle uploaded from
   * a device into Drive (`manual-uploads`). Holds the backup lock so blob
   * cleanup and folder creation cannot race it. Bundle blobs are fully
   * decrypted and checked against their ids before being shared.
   */
  async importUpload(
    tempPath: string,
    originalName: string,
    userId?: string,
  ): Promise<ImportResult> {
    return this.importInspected(
      await this.inspectUpload(tempPath),
      originalName,
      userId,
    );
  }

  /**
   * The fast part of an import (no Drive, no lock): size, SGBK header, key,
   * bundle layout. Bad files are rejected here, while the request is open.
   */
  async inspectUpload(tempPath: string): Promise<InspectedUpload> {
    const { size } = await stat(tempPath);
    if (size > this.config.uploadMaxBytes) {
      throw new PayloadTooLargeException('Backup file is too large');
    }
    const head = await readHead(tempPath);
    const keys = this.config.decryptionKeys();
    const keyIds = new Set(keys.map(backupKeyId));
    const isBundle = looksLikeTar(head);

    // Validate everything that can be validated before taking the lock.
    let bundle: Awaited<ReturnType<typeof readBundle>> | null = null;
    let header: BackupFileHeader;
    try {
      if (isBundle) {
        bundle = await readBundle(tempPath);
        header = await readHeader(openEntry(tempPath, bundle.db));
        if (header.backupId !== bundle.backupId) {
          throw new BadRequestException(
            'Bundle file names do not match the backup inside it',
          );
        }
      } else {
        header = await readHeader(createReadStream(tempPath));
      }
    } catch (err) {
      if (err instanceof TarFormatError) {
        throw new BadRequestException(`Invalid backup bundle: ${err.message}`);
      }
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Not a valid backup file: ${sanitizeError(err)}`,
      );
    }
    this.assertDbHeader(header, keyIds);
    return { tempPath, isBundle, bundle, header };
  }

  /**
   * The slow part: holds the backup lock (waiting for a running backup or
   * check) while blobs, the manifest and the database file go to Drive.
   * Runs in the background after the upload request has been answered.
   */
  async importInspected(
    upload: InspectedUpload,
    originalName: string,
    userId?: string,
  ): Promise<ImportResult> {
    const { tempPath, isBundle, bundle, header } = upload;
    const keys = this.config.decryptionKeys();
    const lock = await this.locks.backup.acquireWithWait(
      IMPORT_LOCK_WAIT_MS,
      2000,
      'import',
    );
    if (!lock) {
      throw new ConflictException(
        'Another backup operation kept running; upload the file again later.',
      );
    }
    const drive = this.locator.drive();
    try {
      const folders = (await this.locator.folders(drive, { create: true }))!;
      const dbSource = () =>
        bundle ? openEntry(tempPath, bundle.db) : createReadStream(tempPath);

      const md5 = await md5Of(dbSource());
      const existing = [
        ...(await drive.listBackups(folders.folderId)),
        ...(await drive.listFiles(folders.manualFolderId!, DB_UPLOAD_KIND)),
      ];
      if (existing.some((f) => f.md5Checksum === md5)) {
        throw new ConflictException('This backup is already in Google Drive');
      }

      let uploadedFiles = 0;
      let uploadedBlobs = 0;
      let manifestFileId: string | null = null;
      if (bundle?.manifest) {
        const manifestBytes = await openPayload(
          openEntry(tempPath, bundle.manifest),
          keys,
          'upload-manifest',
        ).catch((err: unknown) => {
          throw new BadRequestException(
            `The bundle's file list is invalid: ${sanitizeError(err)}`,
          );
        });
        const manifest = parseManifest(manifestBytes.data);
        if (manifest.backupId !== header.backupId) {
          throw new BadRequestException(
            'Bundle file list belongs to another backup',
          );
        }
        const needed = new Set(manifest.files.map((f) => f.blob));
        for (const id of bundle.blobs.keys()) {
          if (!needed.has(id)) {
            throw new BadRequestException(
              `Unexpected file in bundle: ${blobEntryName(id)}`,
            );
          }
        }
        const blobIndex = await loadBlobIndex(drive, folders.folderId, {
          create: true,
        });
        const blobsFolderId = blobIndex.folderId!;
        const inDrive = new Set(blobIndex.files.keys());
        for (const id of needed) {
          if (inDrive.has(id)) continue;
          const entry = bundle.blobs.get(id);
          if (!entry) {
            throw new BadRequestException(
              `The bundle is incomplete: ${blobEntryName(id)} is missing`,
            );
          }
          // Fully decrypted and checked against its id (streamed) before
          // it joins the shared blobs folder.
          const checked = await checkBlobStream({
            source: openEntry(tempPath, entry),
            keys,
            blobId: id,
          });
          if (!checked.ok) {
            throw new BadRequestException(
              `${blobEntryName(id)} is invalid: ${checked.reason}`,
            );
          }
          await drive.uploadResumable(openEntry(tempPath, entry), {
            name: `${id}.sgbk`,
            folderId: blobsFolderId,
            appProperties: {
              [BACKUP_KIND_PROPERTY]: BLOB_KIND,
              [BLOB_ID_PROPERTY]: id,
            },
            signal: lock.signal,
          });
          inDrive.add(id);
          uploadedBlobs++;
        }
        manifestFileId = (
          await drive.uploadResumable(openEntry(tempPath, bundle.manifest), {
            name: manifestEntryName(header.backupId),
            folderId: folders.manualFolderId!,
            appProperties: {
              [BACKUP_KIND_PROPERTY]: MANIFEST_UPLOAD_KIND,
              sgbkBackupId: header.backupId,
              [BACKUP_CREATED_AT_PROPERTY]: header.createdAt,
            },
            signal: lock.signal,
          })
        ).id;
        uploadedFiles = manifest.files.length;
      }

      // The database file goes last: it is what makes the import visible.
      // If it fails, the file list sent above must not stay behind: manual
      // manifests are never pruned and would keep their blobs forever.
      const uploaded = await drive
        .uploadResumable(dbSource(), {
          name: dbEntryName(header.backupId),
          folderId: folders.manualFolderId!,
          appProperties: {
            [BACKUP_KIND_PROPERTY]: DB_UPLOAD_KIND,
            sgbkBackupId: header.backupId,
            [BACKUP_CREATED_AT_PROPERTY]: header.createdAt,
            sgbkKeyId: header.keyId,
            sgbkUploadedBy: (userId ?? '').slice(0, 40),
            sgbkOriginalName: originalName
              .replace(/[^\w.-]+/g, '_')
              .slice(0, 60),
          },
          signal: lock.signal,
        })
        .catch(async (err: unknown) => {
          if (manifestFileId) {
            await drive.deleteFile(manifestFileId).catch(() => undefined);
          }
          throw err;
        });
      this.logger.log(
        `Imported backup ${header.backupId} (${isBundle ? 'bundle' : 'file'}) as ${uploaded.id}: ` +
          `${uploadedFiles} uploaded files listed, ${uploadedBlobs} new blobs`,
      );
      return {
        fileId: uploaded.id,
        backupId: header.backupId,
        format: isBundle ? 'bundle' : 'file',
        uploadedFiles,
        uploadedBlobs,
      };
    } finally {
      await lock.release();
    }
  }

  /** Deletes a backup that was uploaded from a device (and its file list). */
  async deleteUploaded(fileId: string): Promise<{ backupId: string }> {
    const drive: GoogleDriveClient = this.locator.drive();
    const resolved = await this.locator.resolveDbFile(drive, fileId);
    if (!resolved.uploaded) {
      throw new ForbiddenException(
        'Only backups uploaded from a device can be deleted here',
      );
    }
    const manifest = await this.locator.findManifest(drive, resolved);
    if (manifest) await drive.deleteFile(manifest.id);
    await drive.deleteFile(resolved.file.id);
    this.logger.log(`Deleted uploaded backup ${resolved.backupId}`);
    return { backupId: resolved.backupId };
  }
}
