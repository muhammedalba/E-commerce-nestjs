/**
 * End-to-end: export a real database with the backup pipeline, then restore
 * it into a separate database and compare. Needs a disposable MongoDB
 * (replica set, for snapshot reads):
 *
 *   BACKUP_TEST_MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0 \
 *     npx jest --config ./test/jest-e2e.json backup-restore
 *
 * Skipped when the variable is unset. Creates and drops its own randomly
 * named databases; never point it at production.
 */
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { randomBytes } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { mongo } from 'mongoose';
import {
  BackupEncryptStream,
  createBackupHeader,
} from '../src/backup/backup-format';
import { ExportStats, exportDatabase } from '../src/backup/backup-export';
import {
  RestoreSafetyError,
  restoreBackup,
  verifyBackupFile,
} from '../src/backup/restore';

const URI = process.env.BACKUP_TEST_MONGODB_URI;
const describeIf = URI ? describe : describe.skip;
if (!URI) {
  console.warn(
    'backup-restore e2e skipped: set BACKUP_TEST_MONGODB_URI to a disposable MongoDB',
  );
}

const { ObjectId, Decimal128, Long, Binary, Timestamp, Int32, Double } =
  mongo.BSON;
const KEY = randomBytes(32);
const suffix = randomBytes(4).toString('hex');
const SRC = `sgbk_e2e_src_${suffix}`;
const DST = `sgbk_e2e_dst_${suffix}`;

describeIf('backup → restore (real MongoDB)', () => {
  let client: mongo.MongoClient;
  let dir: string;
  let file: string;
  let stats: ExportStats;

  const sortedDocs = (db: mongo.Db, name: string) =>
    db.collection(name).find({}).sort({ _id: 1 }).toArray();
  const bsonOf = (docs: unknown[]) =>
    docs.map((d) =>
      Buffer.from(mongo.BSON.serialize(d as mongo.Document)).toString('hex'),
    );
  const indexShape = async (db: mongo.Db, name: string) =>
    (await db.collection(name).listIndexes().toArray())
      .map((i) => {
        const rest: mongo.Document = { ...(i as mongo.Document) };
        delete rest.v;
        delete rest.ns;
        return JSON.stringify(rest);
      })
      .sort();

  beforeAll(async () => {
    client = await new mongo.MongoClient(URI!).connect();
    dir = mkdtempSync(join(tmpdir(), 'sgbk-e2e-'));
    file = join(dir, 'backup.sgbk');
    const src = client.db(SRC);

    await src.createCollection('orders', {
      validator: { $jsonSchema: { bsonType: 'object', required: ['total'] } },
      collation: { locale: 'ar', strength: 2 },
    });
    await src.collection('orders').insertMany(
      Array.from({ length: 1500 }, (_, i) => ({
        _id: new ObjectId(),
        total: Decimal128.fromString(`${i}.25`),
        count: new Int32(i),
        ratio: new Double(i / 3),
        big: Long.fromNumber(2 ** 53 + i),
        at: new Date(1_700_000_000_000 + i * 1000),
        blob: new Binary(randomBytes(8)),
        ts: new Timestamp({ t: 1_700_000_000, i: i + 1 }),
        note: i % 2 ? 'طلب عربي\nسطر' : null,
        tags: ['a', { nested: [i] }],
      })),
    );
    await src.collection('orders').createIndexes([
      { key: { at: -1 }, name: 'at_desc' },
      { key: { count: 1, at: 1 }, name: 'count_at', unique: true },
      {
        key: { note: 1 },
        name: 'note_partial',
        partialFilterExpression: { note: { $type: 'string' } },
      },
    ]);

    await src.createCollection('sessions');
    await src
      .collection('sessions')
      .insertMany([{ createdAt: new Date() }, { createdAt: new Date() }]);
    await src
      .collection('sessions')
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });

    await src.createCollection('logs', {
      capped: true,
      size: 1024 * 1024,
      max: 100,
    });
    await src
      .collection('logs')
      .insertMany(Array.from({ length: 5 }, (_, i) => ({ i })));

    await src.createCollection('emptyOne');
    await src.createCollection('bigOrders', {
      viewOn: 'orders',
      pipeline: [{ $match: { count: { $gte: 1000 } } }],
    });

    stats = {
      collections: {},
      totalDocs: 0,
      consistency: 'snapshot',
      completed: false,
    };
    const createdAt = new Date();
    const { header, iv } = createBackupHeader({
      backupId: 'e2e',
      createdAt,
      sourceDb: SRC,
      key: KEY,
    });
    await pipeline(
      Readable.from(
        exportDatabase({
          db: src,
          client,
          backupId: 'e2e',
          createdAt,
          batchSize: 100,
          readPreference: 'primary',
          allowNonSnapshot: false,
          stats,
        }),
        { objectMode: false },
      ),
      createGzip(),
      new BackupEncryptStream(KEY, header, iv),
      createWriteStream(file),
    );
  }, 120_000);

  afterAll(async () => {
    if (client) {
      await client
        .db(SRC)
        .dropDatabase()
        .catch(() => undefined);
      await client
        .db(DST)
        .dropDatabase()
        .catch(() => undefined);
      await client.close();
    }
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('exported every collection at one snapshot', async () => {
    expect(stats.completed).toBe(true);
    expect(stats.consistency).toBe('snapshot');
    expect(stats.collections).toEqual({
      bigOrders: 0,
      emptyOne: 0,
      logs: 5,
      orders: 1500,
      sessions: 2,
    });
    const verified = await verifyBackupFile(file, [KEY]);
    expect(verified.end.totalDocs).toBe(1507);
    expect(verified.end.atClusterTime).toBeTruthy();
  });

  it('restores data, BSON types, options, views and indexes into a separate database', async () => {
    const report = await restoreBackup({
      file,
      targetUri: URI!,
      dbName: DST,
      keys: [KEY],
      sourceUri: 'mongodb://production.example.net/skyGalaxy',
    });
    expect(report.totalDocs).toBe(1507);
    const src = client.db(SRC);
    const dst = client.db(DST);

    for (const name of ['orders', 'sessions', 'logs', 'emptyOne']) {
      expect(bsonOf(await sortedDocs(dst, name))).toEqual(
        bsonOf(await sortedDocs(src, name)),
      );
      expect(await indexShape(dst, name)).toEqual(await indexShape(src, name));
    }

    const info = async (db: mongo.Db, name: string) =>
      (await db.listCollections({ name }).toArray())[0] as mongo.CollectionInfo;
    expect((await info(dst, 'orders')).options?.validator).toEqual(
      (await info(src, 'orders')).options?.validator,
    );
    const collation = (await info(dst, 'orders')).options?.collation as
      { locale?: string } | undefined;
    expect(collation?.locale).toBe('ar');
    expect((await info(dst, 'logs')).options).toMatchObject({
      capped: true,
      max: 100,
    });
    expect((await info(dst, 'bigOrders')).type).toBe('view');
    expect(await dst.collection('bigOrders').countDocuments()).toBe(500);
  }, 120_000);

  it('refuses a non-empty target, and --drop without the confirmation', async () => {
    const base = { file, targetUri: URI!, dbName: DST, keys: [KEY] };
    await expect(restoreBackup(base)).rejects.toThrow(/not empty/);
    await expect(restoreBackup({ ...base, drop: true })).rejects.toThrow(
      /--confirm/,
    );
    await expect(
      restoreBackup({ ...base, drop: true, confirmDbName: 'wrong' }),
    ).rejects.toBeInstanceOf(RestoreSafetyError);
    const report = await restoreBackup({
      ...base,
      drop: true,
      confirmDbName: DST,
    });
    expect(report.collections.orders).toEqual({
      expected: 1500,
      restored: 1500,
    });
  }, 120_000);

  it('refuses to restore over the source database on the source cluster', async () => {
    await expect(
      restoreBackup({
        file,
        targetUri: URI!,
        dbName: SRC,
        keys: [KEY],
        sourceUri: URI,
      }),
    ).rejects.toThrow(/live database/);
  });

  it('writes nothing for a tampered backup', async () => {
    const { readFileSync, writeFileSync } = await import('fs');
    const bad = join(dir, 'tampered.sgbk');
    const buf = readFileSync(file);
    buf[buf.length - 100] ^= 0xff;
    writeFileSync(bad, buf);
    const target = `${DST}_tampered`;
    await expect(
      restoreBackup({
        file: bad,
        targetUri: URI!,
        dbName: target,
        keys: [KEY],
      }),
    ).rejects.toThrow();
    expect(await client.db(target).listCollections().toArray()).toEqual([]);
  });
});
