import { randomBytes } from 'crypto';
import { createWriteStream } from 'fs';
import { mkdir, rename, rm, stat } from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import { BackupFormatError } from '../backup-format';
import { openEntry, readBundle } from '../bundle/bundle';
import { DriveFile, GoogleDriveClient } from '../google-drive.client';
import { BACKUP_CREATED_AT_PROPERTY, backupTimestamp } from '../retention';
import {
  MANIFEST_KIND,
  MAX_MANIFEST_BYTES,
  UploadsManifest,
  blobIdOfFile,
  checkBlobStream,
  openPayload,
  parseManifest,
  resolveInside,
} from './uploads-format';
import { loadBlobIndex } from './blob-index';

type Drive = Pick<
  GoogleDriveClient,
  'findFolders' | 'ensureFolder' | 'listFiles' | 'downloadFile'
>;
type Bytes = AsyncIterable<Buffer> | Readable;

/** Where a backup's uploaded files come from: Google Drive or a downloaded bundle. */
export interface UploadsSource {
  backupId: string;
  openManifest(): Promise<Bytes>;
  hasBlob(blobId: string): boolean;
  /** Null when the blob is not available in this source. */
  openBlob(blobId: string): Promise<Bytes | null>;
}

export interface UploadsBackupListing {
  backupId: string;
  createdAt: string | null;
  driveFileId: string;
}

export interface UploadsRestoreReport {
  backupId: string;
  createdAt: string;
  files: number;
  restored: number;
  unchanged: number;
  conflicts: string[];
  missing: string[];
  /** Files whose blob was corrupt or could not be read (nothing written). */
  failed: string[];
  dryRun: boolean;
}

export interface UploadsVerifyReport {
  backupId: string;
  createdAt: string;
  files: number;
  totalBytes: number;
  /** Paths whose blob is absent from the source. */
  missing: string[];
  /** Paths whose blob failed decryption or did not match (deep mode only). */
  corrupt: string[];
  deep: boolean;
}

export class UploadsRestoreError extends Error {
  constructor(
    message: string,
    readonly report?: UploadsRestoreReport,
  ) {
    super(message);
    this.name = 'UploadsRestoreError';
  }
}

// ─── sources ─────────────────────────────────────────────────────────────────

async function backupFolder(
  drive: Drive,
  folderName: string,
): Promise<DriveFile> {
  const [folder] = await drive.findFolders(folderName);
  if (!folder) {
    throw new UploadsRestoreError(
      `No backup folder named "${folderName}" created by this app was found in Google Drive`,
    );
  }
  return folder;
}

/** Uploads manifests available in Drive, newest first. */
export async function listUploadsBackups(
  drive: Drive,
  folderName: string,
): Promise<UploadsBackupListing[]> {
  const folder = await backupFolder(drive, folderName);
  const manifests = await drive.listFiles(folder.id, MANIFEST_KIND);
  return [...manifests]
    .sort((a, b) => (backupTimestamp(b) ?? 0) - (backupTimestamp(a) ?? 0))
    .map((m) => ({
      backupId: m.appProperties?.sgbkBackupId ?? m.name,
      createdAt:
        m.appProperties?.[BACKUP_CREATED_AT_PROPERTY] ?? m.createdTime ?? null,
      driveFileId: m.id,
    }));
}

/** A manifest file in Drive + the shared blobs folder. */
export async function driveUploadsSource(params: {
  drive: Drive;
  manifest: DriveFile;
  /** Folder that holds `uploads-blobs` (the main backup folder). */
  backupFolderId: string;
}): Promise<UploadsSource> {
  const { drive, manifest } = params;
  const { files: blobs } = await loadBlobIndex(drive, params.backupFolderId);
  return {
    backupId: manifest.appProperties?.sgbkBackupId ?? manifest.name,
    openManifest: () => drive.downloadFile(manifest.id),
    hasBlob: (id) => blobs.has(id),
    openBlob: async (id) => {
      const file = blobs.get(id);
      return file ? drive.downloadFile(file.id) : null;
    },
  };
}

/** CLI helper: the uploads of `backupId` (or the latest) in the named Drive folder. */
export async function findDriveUploadsSource(
  drive: Drive,
  folderName: string,
  backupId?: string,
): Promise<UploadsSource> {
  const folder = await backupFolder(drive, folderName);
  const manifests = await drive.listFiles(folder.id, MANIFEST_KIND);
  const sorted = [...manifests].sort(
    (a, b) => (backupTimestamp(b) ?? 0) - (backupTimestamp(a) ?? 0),
  );
  const chosen =
    !backupId || backupId === 'latest'
      ? sorted[0]
      : sorted.find((m) => m.appProperties?.sgbkBackupId === backupId);
  if (!chosen) {
    throw new UploadsRestoreError(
      backupId && backupId !== 'latest'
        ? `No uploads backup with id ${backupId}`
        : 'No uploads backups found in the backup folder',
    );
  }
  return driveUploadsSource({
    drive,
    manifest: chosen,
    backupFolderId: folder.id,
  });
}

/** A downloaded `.backup.tar` bundle on disk (works offline, no Drive access). */
export async function bundleUploadsSource(
  file: string,
): Promise<UploadsSource> {
  const bundle = await readBundle(file);
  const manifest = bundle.manifest;
  if (!manifest) {
    throw new UploadsRestoreError(
      'This bundle has no uploaded files (the backup had no uploads folder)',
    );
  }
  return {
    backupId: bundle.backupId,
    openManifest: () => Promise.resolve(openEntry(file, manifest)),
    hasBlob: (id) => bundle.blobs.has(id),
    openBlob: (id) => {
      const entry = bundle.blobs.get(id);
      return Promise.resolve(entry ? openEntry(file, entry) : null);
    },
  };
}

// ─── manifest / blobs ────────────────────────────────────────────────────────

export async function loadManifest(
  source: UploadsSource,
  keys: Buffer[],
): Promise<UploadsManifest> {
  return (await loadManifestWithKey(source, keys)).manifest;
}

/** The manifest and the key that opened it (blob ids are keyed with it). */
async function loadManifestWithKey(
  source: UploadsSource,
  keys: Buffer[],
): Promise<{ manifest: UploadsManifest; key: Buffer }> {
  const { data, key } = await openPayload(
    await source.openManifest(),
    keys,
    'upload-manifest',
    MAX_MANIFEST_BYTES,
  );
  const manifest = parseManifest(data);
  if (manifest.backupId !== source.backupId) {
    throw new BackupFormatError('Uploads manifest does not match its backup');
  }
  return { manifest, key };
}

type Entry = UploadsManifest['files'][number];

/**
 * Streams one blob through decryption and its checks into `sink` (or
 * nowhere). 'missing' when the source does not have it; otherwise 'ok' or
 * the reason it failed.
 */
async function checkBlob(
  source: UploadsSource,
  keys: Buffer[],
  entry: Entry,
  sink?: ReturnType<typeof createWriteStream>,
): Promise<string> {
  const bytes = await source.openBlob(entry.blob);
  if (!bytes) return 'missing';
  const result = await checkBlobStream({
    source: bytes,
    keys,
    blobId: entry.blob,
    size: entry.size,
    sink,
  });
  return result.ok ? 'ok' : result.reason;
}

/** Whether the file at `dest` already holds exactly this entry's content. */
async function localState(
  dest: string,
  entry: Entry,
  key: Buffer,
): Promise<'absent' | 'same' | 'different'> {
  let size: number;
  try {
    const st = await stat(dest);
    if (!st.isFile()) return 'different';
    size = st.size;
  } catch {
    return 'absent';
  }
  if (size !== entry.size) return 'different';
  // Same keyed id = same content; nothing is downloaded for unchanged files.
  return (await blobIdOfFile(key, dest)) === entry.blob ? 'same' : 'different';
}

/**
 * Checks a backup's uploads without writing anything. Light mode only checks
 * that every listed blob exists; deep mode also decrypts each one and checks
 * it against its keyed id. Each distinct blob is checked once.
 */
export async function verifyUploads(params: {
  source: UploadsSource;
  keys: Buffer[];
  deep: boolean;
  signal?: AbortSignal;
}): Promise<UploadsVerifyReport> {
  const { source, keys, deep } = params;
  const manifest = await loadManifest(source, keys);
  const report: UploadsVerifyReport = {
    backupId: manifest.backupId,
    createdAt: manifest.createdAt,
    files: manifest.files.length,
    totalBytes: manifest.totalBytes,
    missing: [],
    corrupt: [],
    deep,
  };
  const checked = new Map<string, 'ok' | 'missing' | 'corrupt'>();
  for (const entry of manifest.files) {
    params.signal?.throwIfAborted();
    let state = checked.get(entry.blob);
    if (!state) {
      if (!source.hasBlob(entry.blob)) state = 'missing';
      else if (!deep) state = 'ok';
      else {
        try {
          const result = await checkBlob(source, keys, entry);
          state =
            result === 'ok'
              ? 'ok'
              : result === 'missing'
                ? 'missing'
                : 'corrupt';
        } catch {
          state = 'corrupt';
        }
      }
      checked.set(entry.blob, state);
    }
    if (state === 'missing') report.missing.push(entry.path);
    if (state === 'corrupt') report.corrupt.push(entry.path);
  }
  return report;
}

/**
 * Restores a backup's uploaded files into `targetDir`.
 *
 * - The manifest is decrypted and authenticated; paths are validated and
 *   confined to `targetDir`.
 * - An existing file is compared by its keyed id (streamed, no download):
 *   identical → left alone; different → a conflict, only replaced with
 *   `overwrite`. A preview (`dryRun`) therefore downloads nothing.
 * - A file to write is streamed from its blob into a temp file next to it,
 *   checked (GCM tag, size, keyed id), and only then renamed into place —
 *   nothing unverified is ever left at the destination.
 * - A corrupt or unreadable blob is recorded in `failed` and the restore
 *   goes on with the other files.
 * - Throws (after processing everything) if any file was missing, failed or
 *   left as a conflict, so the caller exits non-zero.
 */
export async function restoreUploads(opts: {
  source: UploadsSource;
  keys: Buffer[];
  targetDir: string;
  overwrite?: boolean;
  dryRun?: boolean;
  log?: (message: string) => void;
  /** Called after each file (processed, total). */
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<UploadsRestoreReport> {
  const log = opts.log ?? (() => undefined);
  const { manifest, key } = await loadManifestWithKey(opts.source, opts.keys);
  log(
    `Uploads backup ${manifest.backupId} (${manifest.createdAt}): ${manifest.files.length} files, ${manifest.totalBytes} bytes`,
  );

  const report: UploadsRestoreReport = {
    backupId: manifest.backupId,
    createdAt: manifest.createdAt,
    files: manifest.files.length,
    restored: 0,
    unchanged: 0,
    conflicts: [],
    missing: [],
    failed: [],
    dryRun: !!opts.dryRun,
  };
  const target = path.resolve(opts.targetDir);

  let processed = 0;
  const step = () => opts.onProgress?.(++processed, manifest.files.length);
  for (const entry of manifest.files) {
    opts.signal?.throwIfAborted();
    try {
      const dest = resolveInside(target, entry.path);
      const state = await localState(dest, entry, key);
      if (state === 'same') {
        report.unchanged++;
        continue;
      }
      if (state === 'different' && !opts.overwrite) {
        report.conflicts.push(entry.path);
        continue;
      }
      if (!opts.source.hasBlob(entry.blob)) {
        report.missing.push(entry.path);
        continue;
      }
      if (opts.dryRun) {
        report.restored++;
        continue;
      }
      const outcome = await writeEntry(opts.source, opts.keys, entry, dest);
      if (outcome === 'ok') report.restored++;
      else if (outcome === 'missing') report.missing.push(entry.path);
      else {
        report.failed.push(entry.path);
        log(`  failed:   ${entry.path} (${outcome})`);
      }
    } finally {
      step(); // every outcome (restored, unchanged, conflict, missing, failed) counts
    }
  }

  log(
    `${opts.dryRun ? '[dry run] would restore' : 'Restored'} ${report.restored}, unchanged ${report.unchanged}, ` +
      `conflicts ${report.conflicts.length}, missing ${report.missing.length}, failed ${report.failed.length}`,
  );
  if (
    report.missing.length ||
    report.conflicts.length ||
    report.failed.length
  ) {
    throw new UploadsRestoreError(
      `${report.missing.length} file(s) missing, ${report.failed.length} failed, ${report.conflicts.length} conflict(s) ` +
        `(existing files with different content; use --overwrite to replace them)`,
      report,
    );
  }
  return report;
}

/** Streams, checks, then atomically places one file. Never leaves a partial file. */
async function writeEntry(
  source: UploadsSource,
  keys: Buffer[],
  entry: Entry,
  dest: string,
): Promise<string> {
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.restore-${randomBytes(4).toString('hex')}.tmp`;
  try {
    const result = await checkBlob(
      source,
      keys,
      entry,
      createWriteStream(tmp, { flags: 'wx' }),
    );
    if (result !== 'ok') return result;
    await rename(tmp, dest);
    return 'ok';
  } catch (err) {
    return (err as Error)?.message ?? String(err);
  } finally {
    await rm(tmp, { force: true }).catch(() => undefined);
  }
}
