import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import {
  FakeMongoClient,
  FakeMongoDb,
  buildDbBackup,
} from '../../test/backup-fakes';
import { markLiveDatabase } from './live-marker';
import { writeTar } from './bundle/tar';
import {
  RestoreSafetyError,
  restoreBackup,
  restoreIntoDatabase,
  verifyBackupFile,
  verifyBackupSource,
} from './restore';

const KEY = Buffer.alloc(32, 8);

async function collect(src: AsyncIterable<Buffer>) {
  const parts: Buffer[] = [];
  for await (const c of src) parts.push(c);
  return Buffer.concat(parts);
}

describe('restore core', () => {
  let dir: string;
  let backup: Buffer;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'sgbk-restore-'));
    backup = await buildDbBackup({
      key: KEY,
      backupId: 'b1',
      collections: { orders: [{ n: 1 }, { n: 2 }], users: [{ u: 1 }] },
    });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('verifies from any stream (e.g. Google Drive)', async () => {
    const verified = await verifyBackupSource(
      () => Readable.from([backup.subarray(0, 100), backup.subarray(100)]),
      [KEY],
    );
    expect(verified.counts).toEqual({ orders: 2, users: 1 });
  });

  it('accepts a downloaded bundle wherever a .sgbk file is accepted', async () => {
    const path = join(dir, 'b.backup.tar');
    writeFileSync(
      path,
      await collect(
        writeTar([
          { name: 'README.txt', size: 2, open: () => [Buffer.from('hi')] },
          {
            name: 'skygalaxy-b1.sgbk',
            size: backup.length,
            open: () => [backup],
          },
        ]),
      ),
    );
    expect((await verifyBackupFile(path, [KEY])).end.totalDocs).toBe(3);
  });

  it('restores into an already-open database and reports progress', async () => {
    const db = new FakeMongoDb('target');
    const open = () => Readable.from([backup]);
    const verified = await verifyBackupSource(open, [KEY]);
    const progress: number[] = [];
    const report = await restoreIntoDatabase({
      db: db as never,
      source: open,
      keys: [KEY],
      verified,
      batchSize: 1,
      onProgress: (done) => progress.push(done),
    });
    expect(report).toMatchObject({
      dbName: 'target',
      totalDocs: 3,
      collections: {
        orders: { expected: 2, restored: 2 },
        users: { expected: 1, restored: 1 },
      },
    });
    expect(progress).toEqual([1, 2, 3]);
  });

  it('refuses data that is not the file pass 1 verified', async () => {
    const other = await buildDbBackup({
      key: KEY,
      backupId: 'b1',
      collections: { orders: [{ n: 9 }, { n: 8 }], users: [{ u: 7 }] },
    });
    const verified = await verifyBackupSource(
      () => Readable.from([backup]),
      [KEY],
    );
    await expect(
      restoreIntoDatabase({
        db: new FakeMongoDb('target') as never,
        source: () => Readable.from([other]), // swapped between the passes
        keys: [KEY],
        verified,
      }),
    ).rejects.toThrow(/changed between verification and restore/);
  });

  describe('restoreBackup (CLI) safety', () => {
    let file: string;
    let mongo: FakeMongoClient;
    const run = (over: Partial<Parameters<typeof restoreBackup>[0]>) =>
      restoreBackup({
        file,
        targetUri: 'mongodb://127.0.0.1:27017',
        dbName: 'target',
        keys: [KEY],
        sourceUri: 'mongodb+srv://user:pw@cluster0.example.net/',
        liveDbName: 'skyLive',
        connect: () =>
          Promise.resolve({
            db: (n: string) => mongo.db(n),
            close: () => Promise.resolve(),
          } as never),
        ...over,
      });

    beforeEach(() => {
      file = join(dir, 'b1.sgbk');
      writeFileSync(file, backup);
      mongo = new FakeMongoClient();
    });

    it('refuses the configured live database on the production cluster', async () => {
      await expect(
        run({
          targetUri: 'mongodb+srv://other:pw@cluster0.example.net/',
          dbName: 'skyLive',
        }),
      ).rejects.toThrow(/live database "skyLive"/);
    });

    it('never drops a database an API instance has run on without --overwrite-live', async () => {
      const old = mongo.db('old');
      old.seed('orders', 7);
      await markLiveDatabase(old as never);
      const base = { dbName: 'old', drop: true, confirmDbName: 'old' };

      await expect(run(base)).rejects.toBeInstanceOf(RestoreSafetyError);
      await expect(run(base)).rejects.toThrow(/--overwrite-live/);
      expect(old.dropped).toBe(0);

      const report = await run({ ...base, overwriteLive: true });
      expect(report.totalDocs).toBe(3);
      expect(old.dropped).toBe(1);
    });
  });
});
