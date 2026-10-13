import { mongo } from 'mongoose';
import {
  BACKUP_FORMAT_VERSION,
  CollectionKind,
  ConsistencyMode,
  serializeCollection,
  serializeDoc,
  serializeRecord,
} from './backup-format';
import { isInternalCollection } from './live-marker';

type ClientSession = mongo.ClientSession;
type Db = mongo.Db;
type MongoClient = mongo.MongoClient;
type ReadPreferenceLike = mongo.ReadPreferenceLike;

/** Filled in while the export runs; complete only once the generator returns. */
export interface ExportStats {
  collections: Record<string, number>;
  totalDocs: number;
  consistency: ConsistencyMode;
  completed: boolean;
}

export interface ExportParams {
  db: Pick<Db, 'listCollections' | 'collection' | 'databaseName'>;
  client: Pick<MongoClient, 'startSession'>;
  backupId: string;
  createdAt: Date;
  batchSize: number;
  readPreference: ReadPreferenceLike;
  /** Explicit opt-in to a non point-in-time export (never a silent fallback). */
  allowNonSnapshot: boolean;
  stats: ExportStats;
  signal?: AbortSignal;
  /** Lines are coalesced into chunks of about this size. */
  flushBytes?: number;
}

export class SnapshotUnsupportedError extends Error {
  constructor(cause: string) {
    super(
      `Snapshot reads are not available on this MongoDB deployment (${cause}). ` +
        'Backups need a point-in-time snapshot; set BACKUP_ALLOW_NON_SNAPSHOT=true ' +
        'only if you accept backups whose collections may reflect different moments.',
    );
    this.name = 'SnapshotUnsupportedError';
  }
}

export class ExportIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportIntegrityError';
  }
}

interface CollectionInfoLike {
  name: string;
  type?: string;
  options?: Record<string, unknown>;
}

const SNAPSHOT_TOO_OLD = 239;

function isSnapshotUnsupported(err: unknown): boolean {
  const e = err as { code?: number; message?: string };
  if (e?.code === SNAPSHOT_TOO_OLD) return false;
  return (
    /snapshot/i.test(e?.message ?? '') &&
    /not supported|unsupported|requires|only supported|replica set/i.test(
      e?.message ?? '',
    )
  );
}

function kindOf(info: CollectionInfoLike): CollectionKind {
  if (info.type === 'view') return 'view';
  if (info.type === 'timeseries') return 'timeseries';
  return 'collection';
}

/**
 * Streams the whole database as SGBK NDJSON records (see backup-format.ts),
 * coalesced into ~`flushBytes` Buffers. Pull-based: a cursor batch is only
 * fetched when the consumer asks for more, so memory stays bounded by
 * `batchSize` documents + one output chunk regardless of database size.
 *
 * Consistency: every `find` runs in one snapshot session, so all collections
 * are read at the same cluster time. Collection/index metadata is listed
 * outside the snapshot (listCollections/listIndexes don't support it). In
 * snapshot mode each collection's exported count is cross-checked with a
 * snapshot `countDocuments`; a mismatch fails the export.
 *
 * The generator's `finally` closes the open cursor and ends the session even
 * when the consumer aborts early (pipeline destroy → iterator.return()).
 */
export async function* exportDatabase(
  params: ExportParams,
): AsyncGenerator<Buffer> {
  const {
    db,
    client,
    batchSize,
    readPreference,
    stats,
    signal,
    flushBytes = 256 * 1024,
  } = params;
  const snapshot = !params.allowNonSnapshot;
  stats.consistency = snapshot ? 'snapshot' : 'none';
  stats.collections = {};
  stats.totalDocs = 0;
  stats.completed = false;

  let session: ClientSession | null = null;
  let parts: string[] = [];
  let size = 0;
  const add = (line: string) => {
    parts.push(line, '\n');
    size += line.length + 1;
  };
  const take = (): Buffer => {
    const buf = Buffer.from(parts.join(''), 'utf8');
    parts = [];
    size = 0;
    return buf;
  };

  try {
    if (snapshot) session = client.startSession({ snapshot: true });

    const infos = (
      (await db
        .listCollections({}, { nameOnly: false })
        .toArray()) as CollectionInfoLike[]
    )
      .filter(
        (c) => !c.name.startsWith('system.') && !isInternalCollection(c.name),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    add(
      serializeRecord({
        t: 'begin',
        formatVersion: BACKUP_FORMAT_VERSION,
        backupId: params.backupId,
        createdAt: params.createdAt.toISOString(),
        sourceDb: db.databaseName,
        consistency: stats.consistency,
      }),
    );

    for (const info of infos) {
      signal?.throwIfAborted();
      const kind = kindOf(info);
      const collection = db.collection(info.name);
      const indexes =
        kind === 'view'
          ? []
          : ((await collection.listIndexes().toArray()) as unknown[]);
      add(
        serializeCollection({
          name: info.name,
          type: kind,
          options: info.options ?? {},
          indexes,
        }),
      );

      let count = 0;
      if (kind !== 'view') {
        const cursor = collection.find(
          {},
          {
            batchSize,
            readPreference,
            ...(session && { session }),
          },
        );
        try {
          for await (const doc of cursor) {
            add(serializeDoc(info.name, doc));
            count++;
            if (size >= flushBytes) {
              signal?.throwIfAborted();
              yield take();
            }
          }
        } finally {
          await cursor.close().catch(() => undefined);
        }

        if (session) {
          const expected = await collection.countDocuments(
            {},
            { session, readPreference },
          );
          if (expected !== count) {
            throw new ExportIntegrityError(
              `Collection ${info.name}: exported ${count} documents but the snapshot holds ${expected}`,
            );
          }
        }
      }

      stats.collections[info.name] = count;
      stats.totalDocs += count;
      add(serializeRecord({ t: 'collectionEnd', name: info.name, count }));
    }

    const snapshotTime = session
      ? (session as unknown as { snapshotTime?: unknown }).snapshotTime
      : undefined;
    add(
      serializeRecord({
        t: 'end',
        collections: { ...stats.collections },
        totalDocs: stats.totalDocs,
        completedAt: new Date().toISOString(),
        atClusterTime: snapshotTime
          ? (mongo.BSON.EJSON.serialize(
              { ts: snapshotTime },
              { relaxed: false },
            ).ts as Record<string, unknown>)
          : null,
      }),
    );
    stats.completed = true;
    yield take();
  } catch (err) {
    if (snapshot && isSnapshotUnsupported(err)) {
      throw new SnapshotUnsupportedError((err as Error).message);
    }
    throw err;
  } finally {
    await session?.endSession().catch(() => undefined);
  }
}
