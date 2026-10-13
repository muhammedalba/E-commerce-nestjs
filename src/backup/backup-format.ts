import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from 'crypto';
import { Transform, type TransformCallback } from 'stream';
import { mongo } from 'mongoose';

/**
 * SGBK backup file format, version 1.
 *
 * ```
 * offset  size  field
 * 0       4     magic "SGBK" (ASCII)
 * 4       1     format version (u8) = 1
 * 5       4     header length N (u32, big-endian, ≤ 64 KiB)
 * 9       N     header JSON (UTF-8), see {@link BackupFileHeader}
 * 9+N     …     AES-256-GCM ciphertext of the gzip-compressed payload
 * end-16  16    GCM authentication tag
 * ```
 *
 * The whole prefix (bytes 0 … 9+N) is the GCM additional authenticated data,
 * so the header cannot be altered without failing tag verification.
 *
 * The decrypted, gunzipped payload is NDJSON: one {@link BackupRecord} per
 * line, discriminated by `t`. Document bodies (`doc.d`) and collection
 * metadata (`options`, `indexes`) are canonical Extended JSON, so every BSON
 * type (ObjectId, Date, Decimal128, Long, Int32, Double, Binary, Timestamp,
 * RegExp, MinKey/MaxKey, …) round-trips exactly. The `end` record marks a
 * complete export; a payload without it is rejected.
 */
export const BACKUP_MAGIC = Buffer.from('SGBK', 'ascii');
export const BACKUP_FORMAT_VERSION = 1;
export const GCM_IV_BYTES = 12;
export const GCM_TAG_BYTES = 16;
export const MAX_HEADER_BYTES = 64 * 1024;
const FIXED_PREFIX_BYTES = BACKUP_MAGIC.length + 1 + 4;

const { EJSON } = mongo.BSON;

export interface BackupFileHeader {
  formatVersion: number;
  backupId: string;
  createdAt: string;
  sourceDb: string;
  encryption: 'aes-256-gcm';
  compression: 'gzip';
  /** First 16 hex chars of sha256(key): picks the key, reveals nothing usable. */
  keyId: string;
  /** Base64 12-byte GCM IV, random per backup. */
  iv: string;
  /**
   * What the encrypted payload is. Absent (files made before uploads were
   * backed up) means 'db'. Authenticated like the rest of the header.
   */
  payload?: BackupPayloadKind;
}

/**
 * - db: gzip of the NDJSON database export (below);
 * - upload-blob: gzip of one uploaded file's bytes;
 * - upload-manifest: gzip of the JSON list of uploaded files of one backup.
 */
export type BackupPayloadKind = 'db' | 'upload-blob' | 'upload-manifest';
const PAYLOAD_KINDS: BackupPayloadKind[] = [
  'db',
  'upload-blob',
  'upload-manifest',
];

export const payloadOf = (header: BackupFileHeader): BackupPayloadKind =>
  header.payload ?? 'db';

export type ConsistencyMode = 'snapshot' | 'none';

export interface BeginRecord {
  t: 'begin';
  formatVersion: number;
  backupId: string;
  createdAt: string;
  sourceDb: string;
  consistency: ConsistencyMode;
}

export type CollectionKind = 'collection' | 'view' | 'timeseries';

export interface CollectionRecord {
  t: 'collection';
  name: string;
  type: CollectionKind;
  /** Canonical EJSON of `listCollections().options`. */
  options: Record<string, unknown>;
  /** Canonical EJSON of `listIndexes()` (empty for views). */
  indexes: Record<string, unknown>[];
}

export interface DocRecord {
  t: 'doc';
  c: string;
  /** Canonical EJSON document. */
  d: Record<string, unknown>;
}

export interface CollectionEndRecord {
  t: 'collectionEnd';
  name: string;
  count: number;
}

export interface EndRecord {
  t: 'end';
  collections: Record<string, number>;
  totalDocs: number;
  completedAt: string;
  /** Canonical EJSON Timestamp the snapshot read at, when consistency = snapshot. */
  atClusterTime?: Record<string, unknown> | null;
}

export type BackupRecord =
  BeginRecord | CollectionRecord | DocRecord | CollectionEndRecord | EndRecord;

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupFormatError';
  }
}

// ─── keys ────────────────────────────────────────────────────────────────────

/** Decodes a base64 key and checks it is exactly 32 bytes (AES-256). */
export function decodeBackupKey(base64: string): Buffer {
  const trimmed = (base64 ?? '').trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    throw new BackupFormatError('Backup encryption key is not valid base64');
  }
  const key = Buffer.from(trimmed, 'base64');
  if (key.length !== 32) {
    throw new BackupFormatError(
      `Backup encryption key must decode to 32 bytes (got ${key.length})`,
    );
  }
  return key;
}

export function isValidBackupKey(base64: string | undefined): boolean {
  try {
    decodeBackupKey(base64 ?? '');
    return true;
  } catch {
    return false;
  }
}

export function backupKeyId(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

// ─── header ──────────────────────────────────────────────────────────────────

export function createBackupHeader(input: {
  backupId: string;
  createdAt: Date;
  sourceDb: string;
  key: Buffer;
  payload?: BackupPayloadKind;
}): { header: BackupFileHeader; iv: Buffer } {
  const iv = randomBytes(GCM_IV_BYTES);
  return {
    iv,
    header: {
      formatVersion: BACKUP_FORMAT_VERSION,
      backupId: input.backupId,
      createdAt: input.createdAt.toISOString(),
      sourceDb: input.sourceDb,
      encryption: 'aes-256-gcm',
      compression: 'gzip',
      keyId: backupKeyId(input.key),
      iv: iv.toString('base64'),
      ...(input.payload &&
        input.payload !== 'db' && { payload: input.payload }),
    },
  };
}

export function encodeHeaderPrefix(header: BackupFileHeader): Buffer {
  const json = Buffer.from(JSON.stringify(header), 'utf8');
  if (json.length > MAX_HEADER_BYTES) {
    throw new BackupFormatError('Backup header too large');
  }
  const fixed = Buffer.alloc(FIXED_PREFIX_BYTES);
  BACKUP_MAGIC.copy(fixed, 0);
  fixed.writeUInt8(BACKUP_FORMAT_VERSION, BACKUP_MAGIC.length);
  fixed.writeUInt32BE(json.length, BACKUP_MAGIC.length + 1);
  return Buffer.concat([fixed, json]);
}

/**
 * Parses the prefix at the start of `buf`. Returns null while more bytes are
 * needed; throws on anything that is not a supported SGBK v1 header.
 */
export function tryParseHeaderPrefix(
  buf: Buffer,
): { header: BackupFileHeader; prefixLength: number } | null {
  if (buf.length < FIXED_PREFIX_BYTES) {
    // Fail fast on a wrong magic even before the full fixed prefix arrives.
    const seen = Math.min(buf.length, BACKUP_MAGIC.length);
    if (!buf.subarray(0, seen).equals(BACKUP_MAGIC.subarray(0, seen))) {
      throw new BackupFormatError('Not an SGBK backup file (bad magic)');
    }
    return null;
  }
  if (!buf.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)) {
    throw new BackupFormatError('Not an SGBK backup file (bad magic)');
  }
  const version = buf.readUInt8(BACKUP_MAGIC.length);
  if (version !== BACKUP_FORMAT_VERSION) {
    throw new BackupFormatError(
      `Unsupported backup format version ${version} (this tool reads ${BACKUP_FORMAT_VERSION})`,
    );
  }
  const headerLength = buf.readUInt32BE(BACKUP_MAGIC.length + 1);
  if (headerLength === 0 || headerLength > MAX_HEADER_BYTES) {
    throw new BackupFormatError('Invalid backup header length');
  }
  const prefixLength = FIXED_PREFIX_BYTES + headerLength;
  if (buf.length < prefixLength) return null;

  let header: BackupFileHeader;
  try {
    header = JSON.parse(
      buf.subarray(FIXED_PREFIX_BYTES, prefixLength).toString('utf8'),
    ) as BackupFileHeader;
  } catch {
    throw new BackupFormatError('Backup header is not valid JSON');
  }
  if (
    header?.formatVersion !== BACKUP_FORMAT_VERSION ||
    header.encryption !== 'aes-256-gcm' ||
    header.compression !== 'gzip' ||
    typeof header.keyId !== 'string' ||
    typeof header.iv !== 'string' ||
    Buffer.from(header.iv, 'base64').length !== GCM_IV_BYTES ||
    (header.payload !== undefined && !PAYLOAD_KINDS.includes(header.payload))
  ) {
    throw new BackupFormatError('Backup header has unsupported parameters');
  }
  return { header, prefixLength };
}

// ─── encryption ──────────────────────────────────────────────────────────────

/**
 * Transform: plaintext (gzip bytes) in → complete SGBK file out.
 * Emits the prefix first, the ciphertext as it streams, and the auth tag on
 * flush — the file is only complete once this stream has ended.
 */
export class BackupEncryptStream extends Transform {
  private readonly cipher: CipherGCM;
  private readonly prefix: Buffer;
  private prefixSent = false;

  constructor(key: Buffer, header: BackupFileHeader, iv: Buffer) {
    super();
    if (key.length !== 32) throw new BackupFormatError('Key must be 32 bytes');
    if (header.keyId !== backupKeyId(key)) {
      throw new BackupFormatError('Header keyId does not match the key');
    }
    this.prefix = encodeHeaderPrefix(header);
    this.cipher = createCipheriv('aes-256-gcm', key, iv, {
      authTagLength: GCM_TAG_BYTES,
    });
    this.cipher.setAAD(this.prefix);
  }

  private sendPrefix() {
    if (!this.prefixSent) {
      this.prefixSent = true;
      this.push(this.prefix);
    }
  }

  _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback) {
    try {
      this.sendPrefix();
      const out = this.cipher.update(chunk);
      if (out.length) this.push(out);
      cb();
    } catch (err) {
      cb(err as Error);
    }
  }

  _flush(cb: TransformCallback) {
    try {
      this.sendPrefix();
      const last = this.cipher.final();
      if (last.length) this.push(last);
      this.push(this.cipher.getAuthTag());
      cb();
    } catch (err) {
      cb(err as Error);
    }
  }
}

/**
 * Transform: SGBK file bytes in → decrypted gzip bytes out.
 *
 * GCM can only be verified once the last byte is seen, so plaintext is
 * emitted **before** it is authenticated; the stream errors on flush if the
 * tag does not verify. Callers that act on the data (restore) must run a full
 * verification pass first — see `verifyBackupFile`.
 */
export class BackupDecryptStream extends Transform {
  header: BackupFileHeader | null = null;
  private pending: Buffer = Buffer.alloc(0);
  private decipher: DecipherGCM | null = null;

  constructor(private readonly keys: Buffer[]) {
    super();
  }

  private selectKey(keyId: string): Buffer {
    const key = this.keys.find((k) => backupKeyId(k) === keyId);
    if (!key) {
      throw new BackupFormatError(
        `No configured key matches this backup (keyId ${keyId})`,
      );
    }
    return key;
  }

  _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback) {
    try {
      this.pending = Buffer.concat([this.pending, chunk]);
      if (!this.decipher) {
        const parsed = tryParseHeaderPrefix(this.pending);
        if (!parsed) return cb();
        const prefix = this.pending.subarray(0, parsed.prefixLength);
        this.header = parsed.header;
        this.decipher = createDecipheriv(
          'aes-256-gcm',
          this.selectKey(parsed.header.keyId),
          Buffer.from(parsed.header.iv, 'base64'),
          { authTagLength: GCM_TAG_BYTES },
        );
        this.decipher.setAAD(prefix);
        this.pending = this.pending.subarray(parsed.prefixLength);
      }
      // Hold back the last 16 bytes: they may be the auth tag.
      if (this.pending.length > GCM_TAG_BYTES) {
        const body = this.pending.subarray(
          0,
          this.pending.length - GCM_TAG_BYTES,
        );
        this.pending = Buffer.from(
          this.pending.subarray(this.pending.length - GCM_TAG_BYTES),
        );
        const out = this.decipher.update(body);
        if (out.length) this.push(out);
      }
      cb();
    } catch (err) {
      cb(err as Error);
    }
  }

  _flush(cb: TransformCallback) {
    try {
      if (!this.decipher || this.pending.length !== GCM_TAG_BYTES) {
        throw new BackupFormatError('Backup file is truncated');
      }
      this.decipher.setAuthTag(this.pending);
      const last = this.decipher.final(); // throws if the tag does not verify
      if (last.length) this.push(last);
      cb();
    } catch (err) {
      const e = err as Error;
      cb(
        e instanceof BackupFormatError
          ? e
          : new BackupFormatError(
              'Backup authentication failed: wrong key, or the file was modified or truncated',
            ),
      );
    }
  }
}

// ─── records ─────────────────────────────────────────────────────────────────

const toCanonical = (value: unknown) =>
  EJSON.serialize(value, { relaxed: false }) as Record<string, unknown>;

export function serializeDoc(collection: string, doc: unknown): string {
  return JSON.stringify({ t: 'doc', c: collection, d: toCanonical(doc) });
}

export function serializeCollection(input: {
  name: string;
  type: CollectionKind;
  options: unknown;
  indexes: unknown[];
}): string {
  return JSON.stringify({
    t: 'collection',
    name: input.name,
    type: input.type,
    options: toCanonical(input.options ?? {}),
    indexes: input.indexes.map((i) => toCanonical(i)),
  } satisfies CollectionRecord);
}

export function serializeRecord(
  record: BeginRecord | CollectionEndRecord | EndRecord,
): string {
  return JSON.stringify(record);
}

/** Parses one NDJSON line, validating the record shape. */
export function parseRecord(line: string): BackupRecord {
  let rec: BackupRecord;
  try {
    rec = JSON.parse(line) as BackupRecord;
  } catch {
    throw new BackupFormatError('Corrupt backup payload (invalid JSON line)');
  }
  switch (rec?.t) {
    case 'doc':
      if (typeof rec.c !== 'string' || !rec.d || typeof rec.d !== 'object') {
        throw new BackupFormatError('Corrupt document record');
      }
      return rec;
    case 'collection':
      if (typeof rec.name !== 'string' || !Array.isArray(rec.indexes)) {
        throw new BackupFormatError('Corrupt collection record');
      }
      return rec;
    case 'collectionEnd':
      if (typeof rec.name !== 'string' || typeof rec.count !== 'number') {
        throw new BackupFormatError('Corrupt collectionEnd record');
      }
      return rec;
    case 'begin':
      if (rec.formatVersion !== BACKUP_FORMAT_VERSION) {
        throw new BackupFormatError('Unsupported payload format version');
      }
      return rec;
    case 'end':
      if (typeof rec.totalDocs !== 'number' || !rec.collections) {
        throw new BackupFormatError('Corrupt end record');
      }
      return rec;
    default:
      throw new BackupFormatError('Unknown record type in backup payload');
  }
}

/** Revives canonical EJSON (document bodies, collection options/indexes). */
export function reviveEjson<T = Record<string, unknown>>(value: unknown): T {
  return EJSON.deserialize(value as Record<string, unknown>, {
    relaxed: false,
  }) as T;
}

/**
 * Tracks record order while reading a payload and checks that it describes a
 * complete export: begin first, every doc inside its collection, counts that
 * match, and a final `end` record with matching totals.
 */
export class BackupPayloadValidator {
  begin: BeginRecord | null = null;
  end: EndRecord | null = null;
  readonly counts: Record<string, number> = {};
  private current: string | null = null;
  private readonly seen = new Set<string>();

  accept(rec: BackupRecord): void {
    if (this.end) throw new BackupFormatError('Data after end record');
    if (!this.begin && rec.t !== 'begin') {
      throw new BackupFormatError('Backup payload does not start with begin');
    }
    switch (rec.t) {
      case 'begin':
        if (this.begin) throw new BackupFormatError('Duplicate begin record');
        this.begin = rec;
        return;
      case 'collection':
        if (this.current) throw new BackupFormatError('Unclosed collection');
        if (this.seen.has(rec.name)) {
          throw new BackupFormatError(`Duplicate collection ${rec.name}`);
        }
        this.seen.add(rec.name);
        this.current = rec.name;
        this.counts[rec.name] = 0;
        return;
      case 'doc':
        if (rec.c !== this.current) {
          throw new BackupFormatError('Document outside its collection');
        }
        this.counts[rec.c] += 1;
        return;
      case 'collectionEnd':
        if (rec.name !== this.current || rec.count !== this.counts[rec.name]) {
          throw new BackupFormatError(
            `Document count mismatch in collection ${rec.name}`,
          );
        }
        this.current = null;
        return;
      case 'end': {
        if (this.current) throw new BackupFormatError('Unclosed collection');
        const total = Object.values(this.counts).reduce((a, b) => a + b, 0);
        const sameCollections =
          Object.keys(rec.collections).length ===
            Object.keys(this.counts).length &&
          Object.entries(rec.collections).every(
            ([name, n]) => this.counts[name] === n,
          );
        if (rec.totalDocs !== total || !sameCollections) {
          throw new BackupFormatError('End record does not match the payload');
        }
        this.end = rec;
        return;
      }
    }
  }

  /** Throws unless the payload ended with a valid end record. */
  assertComplete(): EndRecord {
    if (!this.end) {
      throw new BackupFormatError(
        'Backup is incomplete (no end record) — the export did not finish',
      );
    }
    return this.end;
  }
}

/** Transform: bytes in → one string per line out (object mode). */
export class LineSplitter extends Transform {
  private tail = '';
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });

  constructor(private readonly maxLineBytes = 64 * 1024 * 1024) {
    super({ readableObjectMode: true });
  }

  _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback) {
    try {
      const text = this.tail + this.decoder.decode(chunk, { stream: true });
      const lines = text.split('\n');
      this.tail = lines.pop() ?? '';
      if (this.tail.length > this.maxLineBytes) {
        throw new BackupFormatError('Backup line exceeds maximum size');
      }
      for (const line of lines) if (line) this.push(line);
      cb();
    } catch (err) {
      cb(
        err instanceof BackupFormatError
          ? err
          : new BackupFormatError('Corrupt backup payload (invalid UTF-8)'),
      );
    }
  }

  _flush(cb: TransformCallback) {
    try {
      const rest = this.tail + this.decoder.decode();
      if (rest) this.push(rest);
      cb();
    } catch {
      cb(new BackupFormatError('Corrupt backup payload (invalid UTF-8)'));
    }
  }
}
