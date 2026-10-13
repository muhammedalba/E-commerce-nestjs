import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { mongo } from 'mongoose';
import {
  BackupPayloadValidator,
  LineSplitter,
  parseRecord,
  reviveEjson,
} from './backup-format';
import {
  ExportIntegrityError,
  ExportStats,
  SnapshotUnsupportedError,
  exportDatabase,
} from './backup-export';

const { ObjectId, Timestamp } = mongo.BSON;

interface FakeCollection {
  name: string;
  type?: string;
  options?: Record<string, unknown>;
  docs?: () => Iterable<Record<string, unknown>>;
  count?: number;
  failAfter?: number;
}

/** Fake Db/MongoClient exposing only what exportDatabase calls. */
function fakeMongo(
  collections: FakeCollection[],
  opts: { snapshotError?: Error } = {},
) {
  const state = {
    pulled: 0,
    cursorsClosed: 0,
    sessionEnded: false,
    sessions: [] as unknown[],
    findOptions: [] as Record<string, unknown>[],
  };
  const session = {
    snapshotTime: new Timestamp({ t: 1790000000, i: 1 }),
    endSession: () => {
      state.sessionEnded = true;
      return Promise.resolve();
    },
  };
  const db = {
    databaseName: 'skyGalaxy',
    listCollections: () => ({
      toArray: () =>
        Promise.resolve(
          collections.map((c) => ({
            name: c.name,
            type: c.type ?? 'collection',
            options: c.options ?? {},
          })),
        ),
    }),
    collection: (name: string) => {
      const c = collections.find((x) => x.name === name)!;
      return {
        listIndexes: () => ({
          toArray: () =>
            Promise.resolve([{ v: 2, key: { _id: 1 }, name: '_id_' }]),
        }),
        find: (_q: unknown, options: Record<string, unknown>) => {
          state.findOptions.push(options);
          if (opts.snapshotError) throw opts.snapshotError;
          let n = 0;
          const source = c.docs ? c.docs() : [];
          return {
            async *[Symbol.asyncIterator]() {
              for (const doc of source) {
                await Promise.resolve(); // a cursor round-trip
                if (c.failAfter !== undefined && n >= c.failAfter) {
                  throw new Error('cursor died');
                }
                n++;
                state.pulled++;
                yield doc;
              }
            },
            close: () => {
              state.cursorsClosed++;
              return Promise.resolve();
            },
          };
        },
        countDocuments: () => Promise.resolve(c.count ?? 0),
      };
    },
  };
  const client = {
    startSession: (o: unknown) => {
      state.sessions.push(o);
      return session;
    },
  };
  return { db: db as never, client: client as never, state };
}

const docs = (n: number) =>
  function* () {
    for (let i = 0; i < n; i++) {
      yield {
        _id: new ObjectId(),
        i,
        at: new Date(i),
        payload: 'x'.repeat(100),
      };
    }
  };

const newStats = (): ExportStats => ({
  collections: {},
  totalDocs: 0,
  consistency: 'snapshot',
  completed: false,
});

async function collect(gen: AsyncGenerator<Buffer>) {
  const validator = new BackupPayloadValidator();
  const records: ReturnType<typeof parseRecord>[] = [];
  await pipeline(
    Readable.from(gen),
    new LineSplitter(),
    new Writable({
      objectMode: true,
      write(line: string, _e, cb) {
        const rec = parseRecord(line);
        validator.accept(rec);
        records.push(rec);
        cb();
      },
    }),
  );
  return { end: validator.assertComplete(), records, validator };
}

const params = (
  m: ReturnType<typeof fakeMongo>,
  stats: ExportStats,
  extra = {},
) => ({
  db: m.db,
  client: m.client,
  backupId: 'b1',
  createdAt: new Date('2026-10-12T03:00:00Z'),
  batchSize: 100,
  readPreference: 'secondaryPreferred' as const,
  allowNonSnapshot: false,
  stats,
  ...extra,
});

describe('exportDatabase', () => {
  it('never exports the backup system internal collections (live marker)', async () => {
    const m = fakeMongo([
      { name: 'users', docs: docs(1), count: 1 },
      { name: '__sgbk_live', docs: docs(1), count: 1 },
    ]);
    const stats = newStats();
    const { end } = await collect(exportDatabase(params(m, stats)));
    expect(Object.keys(end.collections)).toEqual(['users']);
  });

  it('exports every collection in one snapshot session, views without documents', async () => {
    const m = fakeMongo([
      { name: 'users', docs: docs(3), count: 3 },
      {
        name: 'orders',
        docs: docs(2),
        count: 2,
        options: { collation: { locale: 'ar' } },
      },
      {
        name: 'activeUsers',
        type: 'view',
        options: { viewOn: 'users', pipeline: [] },
      },
      { name: 'system.views' },
    ]);
    const stats = newStats();
    const { end, records } = await collect(exportDatabase(params(m, stats)));

    expect(end.collections).toEqual({ activeUsers: 0, orders: 2, users: 3 });
    expect(end.totalDocs).toBe(5);
    expect(end.atClusterTime).toEqual({ $timestamp: { t: 1790000000, i: 1 } });
    expect(stats).toMatchObject({
      completed: true,
      consistency: 'snapshot',
      totalDocs: 5,
    });
    expect(m.state.sessions).toEqual([{ snapshot: true }]);
    expect(
      m.state.findOptions.every((o) => o.session && o.batchSize === 100),
    ).toBe(true);
    expect(
      m.state.findOptions.every(
        (o) => o.readPreference === 'secondaryPreferred',
      ),
    ).toBe(true);
    expect(m.state.sessionEnded).toBe(true);
    expect(m.state.cursorsClosed).toBe(2);

    const view = records.find(
      (r) => r.t === 'collection' && r.name === 'activeUsers',
    );
    expect(view).toMatchObject({ type: 'view', indexes: [] });
    const firstDoc = records.find((r) => r.t === 'doc')!;
    if (firstDoc.t !== 'doc') throw new Error();
    expect(reviveEjson<{ _id: unknown }>(firstDoc.d)._id).toBeInstanceOf(
      ObjectId,
    );
    expect(
      records.some((r) => r.t === 'collection' && r.name.startsWith('system.')),
    ).toBe(false);
  });

  it('pulls documents lazily: memory stays bounded however large the collection', async () => {
    const m = fakeMongo([{ name: 'big', docs: docs(50_000), count: 50_000 }]);
    const gen = exportDatabase(
      params(m, newStats(), { flushBytes: 64 * 1024 }),
    );
    const first = await gen.next();
    expect(first.done).toBe(false);
    // Only about one output chunk worth of documents was read, not 50k.
    expect(m.state.pulled).toBeLessThan(1000);
    await gen.return(undefined); // consumer stops (e.g. upload failed)
    expect(m.state.cursorsClosed).toBe(1);
    expect(m.state.sessionEnded).toBe(true);
  });

  it('streams a large collection end to end', async () => {
    const m = fakeMongo([{ name: 'big', docs: docs(20_000), count: 20_000 }]);
    const { end } = await collect(exportDatabase(params(m, newStats())));
    expect(end.totalDocs).toBe(20_000);
  });

  it('fails when the snapshot count differs from what was exported', async () => {
    const m = fakeMongo([{ name: 'users', docs: docs(3), count: 4 }]);
    await expect(
      collect(exportDatabase(params(m, newStats()))),
    ).rejects.toBeInstanceOf(ExportIntegrityError);
    expect(m.state.sessionEnded).toBe(true);
  });

  it('closes the cursor and session when a cursor fails mid-collection', async () => {
    const m = fakeMongo([
      { name: 'users', docs: docs(10), count: 10, failAfter: 5 },
    ]);
    const stats = newStats();
    await expect(collect(exportDatabase(params(m, stats)))).rejects.toThrow(
      'cursor died',
    );
    expect(m.state.cursorsClosed).toBe(1);
    expect(m.state.sessionEnded).toBe(true);
    expect(stats.completed).toBe(false);
  });

  it('fails explicitly when snapshot reads are unsupported (no silent fallback)', async () => {
    const m = fakeMongo([{ name: 'users', docs: docs(1), count: 1 }], {
      snapshotError: new Error(
        'readConcern level snapshot is not supported on standalone',
      ),
    });
    await expect(
      collect(exportDatabase(params(m, newStats()))),
    ).rejects.toBeInstanceOf(SnapshotUnsupportedError);
  });

  it('runs without a session only with the explicit non-snapshot opt-in', async () => {
    const m = fakeMongo([{ name: 'users', docs: docs(2), count: 99 }]);
    const stats = newStats();
    const { end, records } = await collect(
      exportDatabase(params(m, stats, { allowNonSnapshot: true })),
    );
    expect(m.state.sessions).toEqual([]);
    expect(m.state.findOptions[0].session).toBeUndefined();
    expect(stats.consistency).toBe('none');
    expect(end.atClusterTime).toBeNull();
    expect(records[0]).toMatchObject({ t: 'begin', consistency: 'none' });
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const m = fakeMongo([
      { name: 'a', docs: docs(10), count: 10 },
      { name: 'b', docs: docs(10), count: 10 },
    ]);
    controller.abort(new Error('lock lost'));
    await expect(
      collect(
        exportDatabase(params(m, newStats(), { signal: controller.signal })),
      ),
    ).rejects.toThrow('lock lost');
    expect(m.state.sessionEnded).toBe(true);
  });
});
