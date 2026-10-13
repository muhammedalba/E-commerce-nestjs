import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { looksLikeTar, openEntry, readBundle, readHead } from './bundle/bundle';
import { Transform, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { mongo } from 'mongoose';
import {
  BackupDecryptStream,
  BackupFileHeader,
  BackupFormatError,
  BackupPayloadValidator,
  BeginRecord,
  CollectionRecord,
  EndRecord,
  LineSplitter,
  decodeBackupKey,
  parseRecord,
  payloadOf,
  reviveEjson,
} from './backup-format';
import { assertNotLiveDatabase } from './live-marker';

type MongoClient = mongo.MongoClient;
type Document = mongo.Document;

export class RestoreSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestoreSafetyError';
  }
}

export interface VerifiedBackup {
  header: BackupFileHeader;
  begin: BeginRecord;
  end: EndRecord;
  counts: Record<string, number>;
  /** SHA-256 of the file's bytes as verified (pass 2 must read the same). */
  sha256: string;
}

/** Passes bytes through while hashing them. */
function hashTap(): { tap: Transform; digest: () => string } {
  const hash = createHash('sha256');
  const tap = new Transform({
    transform(chunk: Buffer, _e, cb) {
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  return { tap, digest: () => hash.digest('hex') };
}

/** Decodes BACKUP_ENCRYPTION_KEY + comma-separated BACKUP_DECRYPTION_KEYS (rotated keys). */
export function keysFromEnv(env: NodeJS.ProcessEnv = process.env): Buffer[] {
  const raw = [
    env.BACKUP_ENCRYPTION_KEY,
    ...(env.BACKUP_DECRYPTION_KEYS ?? '').split(','),
  ]
    .map((k) => k?.trim())
    .filter((k): k is string => !!k);
  if (raw.length === 0) {
    throw new RestoreSafetyError(
      'No decryption key: set BACKUP_ENCRYPTION_KEY (and BACKUP_DECRYPTION_KEYS for older keys)',
    );
  }
  return raw.map(decodeBackupKey);
}

/** Uploads blobs/manifests share the container but are not database backups. */
function assertDbPayload(header: BackupFileHeader | null): void {
  if (header && payloadOf(header) !== 'db') {
    throw new BackupFormatError(
      `This file is not a database backup (payload "${payloadOf(header)}"). Use npm run backup:restore-uploads for uploaded files.`,
    );
  }
}

const toFormatError = (err: unknown): Error =>
  err instanceof BackupFormatError
    ? err
    : new BackupFormatError(
        `Backup payload is corrupt: ${(err as Error)?.message ?? String(err)}`,
      );

/** Opens the encrypted database file's bytes (local file, bundle entry, Drive…). */
export type BackupSource = () =>
  Promise<AsyncIterable<Buffer> | Readable> | AsyncIterable<Buffer> | Readable;

const toReadable = (src: AsyncIterable<Buffer> | Readable): Readable =>
  src instanceof Readable ? src : Readable.from(src);

/**
 * A local `.sgbk` file, or the database entry of a `.backup.tar` bundle
 * (detected by its ustar header).
 */
export async function localBackupSource(file: string): Promise<BackupSource> {
  if (looksLikeTar(await readHead(file))) {
    const bundle = await readBundle(file);
    return () => openEntry(file, bundle.db);
  }
  return () => createReadStream(file);
}

/**
 * Pass 1: reads the whole file and checks the header, the GCM tag (tamper /
 * truncation / wrong key), the gzip stream, every record and the final
 * counts. Writes nothing. Restore only proceeds when this succeeds.
 */
export async function verifyBackupFile(
  file: string,
  keys: Buffer[],
): Promise<VerifiedBackup> {
  return verifyBackupSource(await localBackupSource(file), keys);
}

/** {@link verifyBackupFile} for any source (e.g. streamed from Drive). */
export async function verifyBackupSource(
  source: BackupSource,
  keys: Buffer[],
): Promise<VerifiedBackup> {
  const decrypt = new BackupDecryptStream(keys);
  const validator = new BackupPayloadValidator();
  const hashed = hashTap();
  try {
    await pipeline(
      toReadable(await source()),
      hashed.tap,
      decrypt,
      createGunzip(),
      new LineSplitter(),
      new Writable({
        objectMode: true,
        write(line: string, _enc, cb) {
          try {
            assertDbPayload(decrypt.header);
            const rec = parseRecord(line);
            if (rec.t === 'doc') reviveEjson(rec.d);
            validator.accept(rec);
            cb();
          } catch (err) {
            cb(err as Error);
          }
        },
      }),
    );
  } catch (err) {
    throw toFormatError(err);
  }
  assertDbPayload(decrypt.header);
  const end = validator.assertComplete();
  return {
    header: decrypt.header!,
    begin: validator.begin!,
    end,
    counts: { ...validator.counts },
    sha256: hashed.digest(),
  };
}

/** Host list of a MongoDB URI (credentials and options ignored), lowercased. */
export function uriHosts(uri: string): string[] {
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i);
  return m
    ? m[1]
        .toLowerCase()
        .split(',')
        .map((h) => h.replace(/:27017$/, ''))
    : [];
}

/** Database name from a URI path (`…/name?…`), if present. */
export function uriDatabase(uri: string): string | null {
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/** Options from listCollections that createCollection does not accept as-is. */
function createOptions(options: Record<string, unknown>): Document {
  const rest: Document = { ...options };
  delete rest.uuid;
  if (rest.clusteredIndex && typeof rest.clusteredIndex === 'object') {
    const ci = { ...(rest.clusteredIndex as Document) };
    delete ci.v;
    rest.clusteredIndex = ci;
  }
  return rest;
}

function indexSpecs(indexes: Document[]): mongo.IndexDescription[] {
  return indexes
    .filter((i) => i.name !== '_id_')
    .map((i) => {
      const spec: Document = { ...i };
      delete spec.v;
      delete spec.ns;
      return spec as mongo.IndexDescription;
    });
}

export interface RestoreOptions {
  file: string;
  targetUri: string;
  dbName: string;
  keys: Buffer[];
  /** Replace a non-empty target. Requires `confirmDbName === dbName`. */
  drop?: boolean;
  confirmDbName?: string;
  /** Production URI (MONGODB_URI): restoring over the source db is refused. */
  sourceUri?: string;
  /** The live database name (MONGODB_DB_NAME): refused on the source cluster too. */
  liveDbName?: string;
  /**
   * Allow `drop` of a database an API instance has run on (live marker).
   * Never needed for a fresh target; meant for deliberately replacing an
   * old, no longer used live database.
   */
  overwriteLive?: boolean;
  batchSize?: number;
  log?: (message: string) => void;
  /** Test seam. */
  connect?: (uri: string) => Promise<MongoClient>;
}

export interface RestoreReport {
  backupId: string;
  sourceDb: string;
  createdAt: string;
  consistency: string;
  dbName: string;
  collections: Record<string, { expected: number; restored: number }>;
  views: string[];
  indexes: Record<string, number>;
  totalDocs: number;
}

/**
 * Pass 2 of a restore, into an already-open, empty database: collections
 * with their options, documents in bounded batches (validation bypassed —
 * the data was valid when exported), views, then secondary indexes, and a
 * final per-collection count check. Never closes the client. Callers must
 * have run {@link verifyBackupSource} first and pass its result.
 */
export async function restoreIntoDatabase(params: {
  db: mongo.Db;
  source: BackupSource;
  keys: Buffer[];
  verified: VerifiedBackup;
  batchSize?: number;
  log?: (message: string) => void;
  onProgress?: (restoredDocs: number, totalDocs: number) => void;
}): Promise<RestoreReport> {
  const { db, source, keys, verified, onProgress } = params;
  const log = params.log ?? (() => undefined);
  const batchSize = params.batchSize ?? 500;
  const { header, end } = verified;
  let done = 0;

  const restored: Record<string, number> = {};
  const indexQueue: { name: string; specs: mongo.IndexDescription[] }[] = [];
  const views: CollectionRecord[] = [];
  let current: string | null = null;
  let batch: Document[] = [];

  const flush = async () => {
    if (!current || batch.length === 0) return;
    const docs = batch;
    batch = [];
    await db
      .collection(current)
      .insertMany(docs, { ordered: true, bypassDocumentValidation: true });
    restored[current] += docs.length;
    done += docs.length;
    onProgress?.(done, end.totalDocs);
  };

  const handle = async (line: string) => {
    const rec = parseRecord(line);
    switch (rec.t) {
      case 'collection':
        if (rec.type === 'view') {
          views.push(rec);
          return;
        }
        await db.createCollection(
          rec.name,
          createOptions(reviveEjson(rec.options)),
        );
        indexQueue.push({
          name: rec.name,
          specs: indexSpecs(rec.indexes.map((i) => reviveEjson(i))),
        });
        current = rec.name;
        restored[rec.name] = 0;
        return;
      case 'doc':
        batch.push(reviveEjson<Document>(rec.d));
        if (batch.length >= batchSize) await flush();
        return;
      case 'collectionEnd':
        await flush();
        if (current) log(`  ${current}: ${restored[current]} documents`);
        current = null;
        return;
      default:
        return;
    }
  };

  const hashed = hashTap();
  await pipeline(
    toReadable(await source()),
    hashed.tap,
    new BackupDecryptStream(keys),
    createGunzip(),
    new LineSplitter(),
    new Writable({
      objectMode: true,
      highWaterMark: 64,
      write(line: string, _enc, cb) {
        handle(line).then(() => cb(), cb);
      },
      final(cb) {
        flush().then(() => cb(), cb);
      },
    }),
  );

  // GCM only authenticates at the end of the file, after the documents were
  // inserted: make sure they came from the very bytes pass 1 verified.
  if (hashed.digest() !== verified.sha256) {
    throw new BackupFormatError(
      'The backup file changed between verification and restore; the restored data is incomplete and must not be used.',
    );
  }

  for (const view of views) {
    const options = reviveEjson<{
      viewOn: string;
      pipeline: Document[];
      collation?: mongo.CollationOptions;
    }>(view.options);
    await db.createCollection(view.name, {
      viewOn: options.viewOn,
      pipeline: options.pipeline,
      ...(options.collation && { collation: options.collation }),
    });
  }

  const indexes: Record<string, number> = {};
  for (const { name, specs } of indexQueue) {
    if (specs.length) await db.collection(name).createIndexes(specs);
    indexes[name] = specs.length;
  }

  const collections: RestoreReport['collections'] = {};
  for (const [name, expected] of Object.entries(verified.counts)) {
    if (views.some((v) => v.name === name)) continue;
    const count = await db.collection(name).countDocuments();
    collections[name] = { expected, restored: count };
    if (count !== expected) {
      throw new Error(
        `Restore verification failed for ${name}: expected ${expected} documents, found ${count}`,
      );
    }
  }
  log(
    `Restore complete: ${Object.keys(collections).length} collections, ${views.length} views, ` +
      `${end.totalDocs} documents, ${Object.values(indexes).reduce((a, b) => a + b, 0)} indexes`,
  );

  return {
    backupId: header.backupId,
    sourceDb: header.sourceDb,
    createdAt: header.createdAt,
    consistency: verified.begin.consistency,
    dbName: db.databaseName,
    collections,
    views: views.map((v) => v.name),
    indexes,
    totalDocs: end.totalDocs,
  };
}

/**
 * Restores an SGBK backup into `dbName` on `targetUri`.
 *
 * Safety: verifies the whole file first (nothing is written for a tampered,
 * truncated or incomplete backup); refuses the source database on the
 * source cluster; refuses a non-empty target unless `drop` is set AND the
 * database name is confirmed. Never logs the target URI.
 *
 * Restores data, collection options (validators, collation, capped,
 * time-series, clustered), views and secondary indexes. Documents are
 * inserted in bounded batches with document validation bypassed (the data
 * was valid when exported); indexes are built after the data.
 */
export async function restoreBackup(
  opts: RestoreOptions,
): Promise<RestoreReport> {
  const log = opts.log ?? (() => undefined);
  const batchSize = opts.batchSize ?? 500;
  if (!opts.dbName?.trim()) {
    throw new RestoreSafetyError('A target database name is required');
  }

  log('Verifying backup (decrypt + authenticate + parse)…');
  const source = await localBackupSource(opts.file);
  const verified = await verifyBackupSource(source, opts.keys);
  const { header, end } = verified;
  log(
    `Backup ${header.backupId}: source db "${header.sourceDb}", created ${header.createdAt}, ` +
      `${Object.keys(verified.counts).length} collections, ${end.totalDocs} documents, ` +
      `consistency=${verified.begin.consistency}`,
  );

  if (opts.sourceUri) {
    const sourceHosts = new Set(uriHosts(opts.sourceUri));
    const sameCluster = uriHosts(opts.targetUri).some((h) =>
      sourceHosts.has(h),
    );
    const liveNames = new Set(
      [header.sourceDb, opts.liveDbName].filter((n): n is string => !!n),
    );
    if (sameCluster && liveNames.has(opts.dbName)) {
      throw new RestoreSafetyError(
        `Refusing to restore into the live database "${opts.dbName}" on the production cluster. Restore into a separate database.`,
      );
    }
  }

  const client = opts.connect
    ? await opts.connect(opts.targetUri)
    : await new mongo.MongoClient(opts.targetUri).connect();
  try {
    const db = client.db(opts.dbName);
    log(`Target database: "${opts.dbName}"`);

    const existing = (
      await db.listCollections({}, { nameOnly: true }).toArray()
    ).filter((c) => !c.name.startsWith('system.'));
    if (existing.length > 0) {
      if (!opts.drop) {
        throw new RestoreSafetyError(
          `Target database "${opts.dbName}" is not empty (${existing.length} collections). ` +
            `Restore into an empty database, or pass --drop --confirm ${opts.dbName} to replace it.`,
        );
      }
      if (opts.confirmDbName !== opts.dbName) {
        throw new RestoreSafetyError(
          `--drop requires --confirm ${opts.dbName} (the exact target database name)`,
        );
      }
      // Host comparison can miss the same cluster (SRV vs seed list,
      // localhost vs 127.0.0.1); the live marker cannot.
      if (!opts.overwriteLive) {
        try {
          await assertNotLiveDatabase(db, 'drop');
        } catch (err) {
          throw new RestoreSafetyError(
            `${(err as Error).message} To replace it anyway, add --overwrite-live.`,
          );
        }
      }
      log(
        `Dropping target database "${opts.dbName}" (${existing.length} collections)…`,
      );
      await db.dropDatabase();
    }

    return await restoreIntoDatabase({
      db,
      source,
      keys: opts.keys,
      verified,
      batchSize,
      log,
    });
  } finally {
    await client.close();
  }
}
