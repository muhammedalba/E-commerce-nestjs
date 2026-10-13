import { createHmac, hkdfSync, timingSafeEqual } from 'crypto';
import { createReadStream } from 'fs';
import { lstat, readdir } from 'fs/promises';
import * as path from 'path';
import { Readable, Transform, Writable, pipeline as pipe } from 'stream';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import { createGunzip, createGzip, gzip } from 'zlib';
import {
  BackupDecryptStream,
  BackupEncryptStream,
  BackupFileHeader,
  BackupFormatError,
  BackupPayloadKind,
  backupKeyId,
  createBackupHeader,
  payloadOf,
} from '../backup-format';

const gzipAsync = promisify(gzip);

/**
 * Uploaded files (the local `uploads` folder) are backed up incrementally:
 *
 * - every distinct file content is stored once in Drive as a "blob", named by
 *   its blob id = HMAC-SHA256(k, content), with k derived from the backup key
 *   (HKDF). Unlike a plain hash, the id reveals nothing about the content to
 *   someone without the key;
 * - each backup run writes a small "manifest" listing every file (relative
 *   path → blob id) that existed at that moment.
 *
 * Blobs and manifests use the same SGBK container as database backups (AES-
 * 256-GCM over gzip, header authenticated), with `payload` = 'upload-blob' /
 * 'upload-manifest'. Restoring a backup's uploads = fetching its manifest,
 * then each listed blob.
 */
export const UPLOADS_MANIFEST_VERSION = 1;
export const MANIFEST_KIND = 'uploads-manifest';
export const BLOB_KIND = 'upload-blob';
export const BLOBS_FOLDER_NAME = 'uploads-blobs';
export const BLOBS_FOLDER_ROLE = 'upload-blobs';
/** appProperty holding a blob file's id. */
export const BLOB_ID_PROPERTY = 'sgbkBlob';
/**
 * Uploaded files larger than this are left out of the backup (with a
 * warning) — they are streamed, so this only bounds time and Drive space.
 */
export const MAX_UPLOAD_FILE_BYTES = 2 * 1024 * 1024 * 1024;
/** Manifests are read into memory; they are small JSON lists. */
export const MAX_MANIFEST_BYTES = 256 * 1024 * 1024;

export interface UploadsManifestEntry {
  /** Relative to the uploads root, '/' separated (e.g. "Product/abc.webp"). */
  path: string;
  blob: string;
  size: number;
  mtime: string;
}

export interface UploadsManifest {
  formatVersion: number;
  backupId: string;
  createdAt: string;
  files: UploadsManifestEntry[];
  totalBytes: number;
}

// ─── identity ────────────────────────────────────────────────────────────────

const blobKeys = new WeakMap<Buffer, Buffer>();

function blobIdKey(key: Buffer): Buffer {
  let derived = blobKeys.get(key);
  if (!derived) {
    derived = Buffer.from(
      hkdfSync('sha256', key, Buffer.alloc(0), 'sgbk upload blob id v1', 32),
    );
    blobKeys.set(key, derived);
  }
  return derived;
}

/** Content id of a file: keyed, so it can't be used to test for known files. */
export function blobIdFor(key: Buffer, data: Buffer): string {
  return createHmac('sha256', blobIdKey(key)).update(data).digest('hex');
}

export function blobIdMatches(key: Buffer, data: Buffer, id: string): boolean {
  return sameId(blobIdFor(key, data), id);
}

const sameId = (a: string, b: string): boolean => {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

/**
 * {@link blobIdFor} of a file on disk and the number of bytes it was
 * computed over, streamed (any size, constant memory).
 */
export async function hashFile(
  key: Buffer,
  file: string,
): Promise<{ id: string; size: number }> {
  const hmac = createHmac('sha256', blobIdKey(key));
  let size = 0;
  for await (const chunk of createReadStream(file)) {
    hmac.update(chunk as Buffer);
    size += (chunk as Buffer).length;
  }
  return { id: hmac.digest('hex'), size };
}

/** {@link blobIdFor} of a file on disk, streamed. */
export async function blobIdOfFile(key: Buffer, file: string): Promise<string> {
  return (await hashFile(key, file)).id;
}

/**
 * Streams `source` (a file's bytes) as a sealed blob: gzip → AES-256-GCM in
 * the SGBK container. `digest()` gives the blob id of the bytes that were
 * actually sealed — compare it with the id the blob is stored under, in
 * case the file changed while it was read.
 */
export function sealBlobStream(params: {
  key: Buffer;
  id: string;
  createdAt: Date;
  sourceDb: string;
  source: Readable;
}): { stream: Readable; digest: () => string; size: () => number } {
  const { header, iv } = createBackupHeader({
    backupId: params.id,
    createdAt: params.createdAt,
    sourceDb: params.sourceDb,
    key: params.key,
    payload: 'upload-blob',
  });
  const hmac = createHmac('sha256', blobIdKey(params.key));
  let size = 0;
  const tap = new Transform({
    transform(chunk: Buffer, _e, cb) {
      hmac.update(chunk);
      size += chunk.length;
      cb(null, chunk);
    },
  });
  const sealed = new BackupEncryptStream(params.key, header, iv);
  // Errors anywhere destroy every stream, so the consumer of `sealed` sees them.
  pipe(params.source, tap, createGzip({ level: 6 }), sealed, () => undefined);
  let digest: string | null = null;
  return {
    stream: sealed,
    digest: () => (digest ??= hmac.digest('hex')),
    size: () => size,
  };
}

/**
 * Decrypts a sealed blob as a stream and checks it: payload kind, GCM tag,
 * size and keyed id. Plaintext goes to `sink` (e.g. a temp file) as it is
 * decrypted — only trust it if the result is `ok`. Constant memory.
 */
export async function checkBlobStream(params: {
  source: AsyncIterable<Buffer> | Readable;
  keys: Buffer[];
  blobId: string;
  size?: number;
  sink?: Writable;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const decrypt = new BackupDecryptStream(params.keys);
  let hmac: ReturnType<typeof createHmac> | null = null;
  let size = 0;
  /** Set up from the authenticated header (before the first plaintext byte). */
  const start = () => {
    const header = decrypt.header!;
    if (payloadOf(header) !== 'upload-blob') {
      throw new BackupFormatError(
        `Expected a upload-blob payload, got ${payloadOf(header)}`,
      );
    }
    const key = params.keys.find((k) => backupKeyId(k) === header.keyId)!;
    return createHmac('sha256', blobIdKey(key));
  };
  const check = new Transform({
    transform(chunk: Buffer, _e, cb) {
      try {
        hmac ??= start();
        hmac.update(chunk);
        size += chunk.length;
        cb(null, chunk);
      } catch (err) {
        cb(err as Error);
      }
    },
  });
  try {
    await pipeline(
      params.source instanceof Readable
        ? params.source
        : Readable.from(params.source),
      decrypt,
      createGunzip(),
      check,
      params.sink ??
        new Writable({
          write: (_c, _e, cb) => cb(),
        }),
    );
    hmac ??= start(); // an empty file: no chunk went through
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof BackupFormatError
          ? err.message
          : `Corrupt upload-blob: ${(err as Error)?.message ?? String(err)}`,
    };
  }
  const actual = hmac.digest('hex');
  if (!sameId(actual, params.blobId)) {
    return { ok: false, reason: 'Blob content does not match its id' };
  }
  if (params.size !== undefined && size !== params.size) {
    return { ok: false, reason: 'Blob size does not match the manifest' };
  }
  return { ok: true };
}

// ─── paths ───────────────────────────────────────────────────────────────────

/**
 * Validates a manifest path before it is joined to a restore directory:
 * relative, '/' separated, no empty/'.'/'..' segments, no drive letters,
 * backslashes or control characters. Throws on anything else.
 */
export function assertSafeRelativePath(rel: string): string {
  if (
    typeof rel !== 'string' ||
    rel.length === 0 ||
    rel.length > 1024 ||
    rel.startsWith('/') ||
    /[\\:\p{Cc}]/u.test(rel) ||
    rel.split('/').some((s) => s === '' || s === '.' || s === '..')
  ) {
    throw new BackupFormatError(`Unsafe path in uploads manifest: ${rel}`);
  }
  return rel;
}

/** `root` + relative path, guaranteed to stay inside `root`. */
export function resolveInside(root: string, rel: string): string {
  const base = path.resolve(root);
  const resolved = path.resolve(base, assertSafeRelativePath(rel));
  if (!resolved.startsWith(base + path.sep)) {
    throw new BackupFormatError(`Path escapes the target directory: ${rel}`);
  }
  return resolved;
}

export interface LocalUpload {
  rel: string;
  abs: string;
  size: number;
  mtimeMs: number;
}

/**
 * Every regular file under `root` (recursively), sorted by path. Symbolic
 * links are skipped (never followed outside the uploads folder).
 */
export async function listLocalUploads(root: string): Promise<LocalUpload[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files: LocalUpload[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const abs = path.join(entry.parentPath, entry.name);
    const stat = await lstat(abs);
    if (!stat.isFile()) continue;
    const rel = path.relative(root, abs).split(path.sep).join('/');
    files.push({ rel, abs, size: stat.size, mtimeMs: stat.mtimeMs });
  }
  return files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

// ─── encryption of small payloads ────────────────────────────────────────────

/** gzip → AES-256-GCM in the SGBK container, as one Buffer (small payloads). */
export async function sealPayload(params: {
  key: Buffer;
  payload: BackupPayloadKind;
  id: string;
  createdAt: Date;
  sourceDb: string;
  data: Buffer;
}): Promise<Buffer> {
  const { header, iv } = createBackupHeader({
    backupId: params.id,
    createdAt: params.createdAt,
    sourceDb: params.sourceDb,
    key: params.key,
    payload: params.payload,
  });
  const compressed = await gzipAsync(params.data, { level: 6 });
  const parts: Buffer[] = [];
  await pipeline(
    Readable.from([compressed]),
    new BackupEncryptStream(params.key, header, iv),
    new Writable({
      write(chunk: Buffer, _e, cb) {
        parts.push(chunk);
        cb();
      },
    }),
  );
  return Buffer.concat(parts);
}

/**
 * Decrypts, authenticates and gunzips a sealed payload, checking that it is
 * the expected kind. Returns the plaintext and the key that opened it.
 * `maxBytes` bounds memory against a hostile or corrupt file.
 */
export async function openPayload(
  source: AsyncIterable<Buffer> | Readable,
  keys: Buffer[],
  expected: BackupPayloadKind,
  maxBytes = MAX_UPLOAD_FILE_BYTES,
): Promise<{ data: Buffer; header: BackupFileHeader; key: Buffer }> {
  const decrypt = new BackupDecryptStream(keys);
  const parts: Buffer[] = [];
  let size = 0;
  try {
    await pipeline(
      source instanceof Readable ? source : Readable.from(source),
      decrypt,
      createGunzip(),
      new Writable({
        write(chunk: Buffer, _e, cb) {
          if (decrypt.header && payloadOf(decrypt.header) !== expected) {
            return cb(
              new BackupFormatError(
                `Expected a ${expected} payload, got ${payloadOf(decrypt.header)}`,
              ),
            );
          }
          size += chunk.length;
          if (size > maxBytes) {
            return cb(new BackupFormatError('Payload exceeds the size limit'));
          }
          parts.push(chunk);
          cb();
        },
      }),
    );
  } catch (err) {
    throw err instanceof BackupFormatError
      ? err
      : new BackupFormatError(
          `Corrupt ${expected}: ${(err as Error)?.message ?? String(err)}`,
        );
  }
  const header = decrypt.header!;
  if (payloadOf(header) !== expected) {
    throw new BackupFormatError(
      `Expected a ${expected} payload, got ${payloadOf(header)}`,
    );
  }
  const key = keys.find((k) => backupKeyId(k) === header.keyId)!;
  return { data: Buffer.concat(parts), header, key };
}

/** Parses and validates a decrypted manifest. */
export function parseManifest(data: Buffer): UploadsManifest {
  let manifest: UploadsManifest;
  try {
    manifest = JSON.parse(data.toString('utf8')) as UploadsManifest;
  } catch {
    throw new BackupFormatError('Uploads manifest is not valid JSON');
  }
  if (
    manifest?.formatVersion !== UPLOADS_MANIFEST_VERSION ||
    typeof manifest.backupId !== 'string' ||
    !Array.isArray(manifest.files)
  ) {
    throw new BackupFormatError('Unsupported uploads manifest');
  }
  for (const f of manifest.files) {
    assertSafeRelativePath(f?.path);
    if (!/^[0-9a-f]{64}$/.test(f.blob) || !Number.isInteger(f.size)) {
      throw new BackupFormatError(`Corrupt manifest entry: ${f.path}`);
    }
  }
  return manifest;
}
