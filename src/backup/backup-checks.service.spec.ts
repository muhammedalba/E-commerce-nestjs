import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { Types } from 'mongoose';
import {
  FakeMongoClient,
  FakeMongoDb,
  MemoryDrive,
  buildDbBackup,
  memoryModel,
} from '../../test/backup-fakes';
import { BackupChecksService } from './backup-checks.service';
import { BackupLocator } from './backup-locator';
import { DB_UPLOAD_KIND } from './backup.types';
import { LIVE_MARKER_COLLECTION, markLiveDatabase } from './live-marker';
import { BACKUP_KIND_VALUE } from './retention';
import { UploadsBackupService } from './uploads/uploads-backup.service';
import { BLOB_KIND } from './uploads/uploads-format';

const KEY = Buffer.alloc(32, 6);
const FOLDER = 'skygalaxy-db-backups';

type Doc = Record<string, unknown> & { _id: Types.ObjectId; createdAt: Date };

/** Tiny in-memory Mongoose-like model ($in / $ne filters, createdAt sort). */
function docModel() {
  const docs: Doc[] = [];
  let tick = 0;
  const matches = (d: Doc, filter: Record<string, unknown>) =>
    Object.entries(filter).every(([k, v]) => {
      const val = d[k];
      if (v && typeof v === 'object' && !(v instanceof Types.ObjectId)) {
        if ('$in' in v) return (v.$in as unknown[]).includes(val);
        if ('$ne' in v) return String(val) !== String(v.$ne);
        if ('$lt' in v) return +(val as Date) < +(v.$lt as Date);
      }
      return String(val) === String(v);
    });
  const query = (rows: () => Doc[]) => ({
    sort: () => ({
      lean: () =>
        Promise.resolve(
          [...rows()].sort((a, b) => +b.createdAt - +a.createdAt),
        ),
    }),
    lean: () => Promise.resolve(rows()),
  });
  return {
    docs,
    create: (doc: Record<string, unknown>) => {
      const d = {
        dropped: false,
        ...doc,
        _id: new Types.ObjectId(),
        createdAt: new Date(Date.now() + tick++),
      } as Doc;
      docs.push(d);
      return Promise.resolve(d);
    },
    updateOne: (filter: Record<string, unknown>, u: { $set: object }) => {
      const d = docs.find((x) => matches(x, filter));
      if (d) Object.assign(d, u.$set);
      return Promise.resolve({});
    },
    updateMany: (filter: Record<string, unknown>, u: { $set: object }) => {
      const hit = docs.filter((x) => matches(x, filter));
      hit.forEach((d) => Object.assign(d, u.$set));
      return Promise.resolve({ modifiedCount: hit.length });
    },
    find: (filter: Record<string, unknown>) =>
      query(() => docs.filter((d) => matches(d, filter))),
    findOne: (filter: Record<string, unknown>) => ({
      sort: () => ({
        lean: () =>
          Promise.resolve(
            [...docs]
              .filter((d) => matches(d, filter))
              .sort((a, b) => +b.createdAt - +a.createdAt)[0] ?? null,
          ),
      }),
    }),
    findById: (id: string) => ({
      lean: () =>
        Promise.resolve(docs.find((d) => String(d._id) === id) ?? null),
    }),
  };
}

describe('BackupChecksService', () => {
  let work: string;
  let drive: MemoryDrive;
  let folderId: string;
  let live: FakeMongoDb;
  let client: FakeMongoClient;
  let checks: ReturnType<typeof docModel>;
  let runs: ReturnType<typeof docModel>;
  let service: BackupChecksService;
  let maxBytes: number | null;

  async function addBackup(backupId: string, opts: { uploads?: boolean } = {}) {
    const data = await buildDbBackup({
      key: KEY,
      backupId,
      collections: {
        orders: [{ n: 1 }, { n: 2 }, { n: 3 }],
        users: [{ name: 'a' }],
      },
    });
    const file = drive.add({
      name: `skygalaxy-${backupId}.sgbk`,
      parents: [folderId],
      size: String(data.length),
      data,
      appProperties: {
        sgbkKind: BACKUP_KIND_VALUE,
        sgbkBackupId: backupId,
        sgbkCreatedAt: new Date().toISOString(),
      },
    });
    if (opts.uploads) {
      const dir = join(work, backupId);
      mkdirSync(join(dir, 'Product'), { recursive: true });
      writeFileSync(join(dir, 'Product/a.webp'), 'a');
      const uploads = new UploadsBackupService(
        memoryModel('path') as never,
        memoryModel('driveFileId') as never,
      );
      jest.spyOn(uploads, 'uploadsRoot').mockReturnValue(dir);
      await uploads.backup({
        drive: drive,
        folderId,
        backupId,
        createdAt: new Date(),
        sourceDb: 'skyGalaxy',
        key: KEY,
      });
    }
    return file;
  }

  const newCheck = (kind: 'verify' | 'test-restore', fileId: string) =>
    service.createCheck({ kind, fileId, trigger: 'manual' });
  const check = (id: string) => checks.docs.find((d) => String(d._id) === id)!;

  beforeEach(async () => {
    work = mkdtempSync(join(tmpdir(), 'sgbk-checks-'));
    drive = new MemoryDrive();
    folderId = (await drive.ensureFolder(FOLDER)).id;
    client = new FakeMongoClient();
    live = client.db('skyGalaxy');
    live.seed('orders', 5); // two orders newer than the backup
    live.seed('users', 1);
    live.seed('reviews', 4); // collection created after the backup
    checks = docModel();
    runs = docModel();
    maxBytes = null;
    const store = {
      get: () =>
        Promise.resolve({ googleDrive: { folderName: FOLDER, folderId } }),
      setFolderId: jest.fn().mockResolvedValue(undefined),
    };
    const locator = new BackupLocator(
      store as never,
      { create: () => drive } as never,
    );
    const config = {
      decryptionKeys: () => [KEY],
      get testRestoreMaxBytes() {
        return maxBytes;
      },
    };
    const connection = { db: live, getClient: () => client };
    service = new BackupChecksService(
      connection as never,
      checks as never,
      runs as never,
      config as never,
      locator,
    );
  });
  afterEach(() => rmSync(work, { recursive: true, force: true }));

  describe('listBackups', () => {
    it('lists server-made and uploaded backups with their run and verification', async () => {
      const made = await addBackup('b-made', { uploads: true });
      await runs.create({
        kind: 'backup',
        status: 'succeeded',
        backupId: 'b-made',
        trigger: 'manual',
        totalDocs: 4,
        uploads: { files: 1 },
      });
      const manual = await drive.ensureFolder('manual-uploads', undefined, {
        role: 'manual-uploads',
        parentId: folderId,
      });
      drive.add({
        name: 'skygalaxy-b-up.sgbk',
        parents: [manual.id],
        size: '10',
        appProperties: { sgbkKind: DB_UPLOAD_KIND, sgbkBackupId: 'b-up' },
      });
      const id = await newCheck('verify', made.id);
      await service.verify(id, made.id, { deepUploads: true });

      const list = await service.listBackups();
      expect(list).toHaveLength(2);
      const byId = Object.fromEntries(list.map((b) => [b.backupId, b]));
      expect(byId['b-made']).toMatchObject({
        source: 'manual',
        totalDocs: 4,
        hasUploads: true,
        uploadedFiles: 1,
        verification: { status: 'succeeded' },
      });
      expect(byId['b-up']).toMatchObject({
        source: 'uploaded',
        hasUploads: false,
        verification: null,
      });
    });

    it('reuses the Drive listing briefly; fresh or invalidated reads Drive again', async () => {
      await addBackup('b1');
      const listFiles = jest.spyOn(drive, 'listFiles');
      await service.listBackups();
      const calls = listFiles.mock.calls.length;
      await service.listBackups(); // polling: MongoDB only
      expect(listFiles.mock.calls.length).toBe(calls);
      await service.listBackups({ fresh: true });
      expect(listFiles.mock.calls.length).toBe(2 * calls);
      service.invalidateListing();
      await addBackup('b2');
      expect(await service.listBackups()).toHaveLength(2);
    });

    it('returns an empty list when no backup folder exists yet', async () => {
      drive.files.clear();
      expect(await service.listBackups()).toEqual([]);
    });
  });

  it('fails checks left queued or running by a crash, not recent ones', async () => {
    const old = await newCheck('verify', 'fakeDriveId000001');
    check(old).createdAt = new Date(Date.now() - 13 * 60 * 60 * 1000);
    const recent = await newCheck('verify', 'fakeDriveId000002');
    expect(await service.failStale(12 * 60 * 60 * 1000)).toBe(1);
    expect(check(old)).toMatchObject({ status: 'failed' });
    expect(check(old).error).toMatch(/Interrupted/);
    expect(check(recent).status).toBe('queued');
  });

  describe('verify', () => {
    it('records a full report for a valid backup', async () => {
      const file = await addBackup('b1', { uploads: true });
      const id = await newCheck('verify', file.id);
      expect(await service.verify(id, file.id, { deepUploads: true })).toBe(
        'succeeded',
      );
      expect(check(id)).toMatchObject({
        status: 'succeeded',
        backupId: 'b1',
        report: {
          totalDocs: 4,
          collections: { orders: 3, users: 1 },
          consistency: 'snapshot',
          uploads: { files: 1, deep: true, missing: [], corrupt: [] },
        },
      });
    });

    it('records the outcome on the Drive file for retention', async () => {
      const good = await addBackup('b1');
      await service.verify(await newCheck('verify', good.id), good.id, {
        deepUploads: true,
      });
      expect(good.appProperties.sgbkVerified).toBe('ok');

      const bad = await addBackup('b2');
      bad.data![bad.data!.length - 10] ^= 0xff;
      await service.verify(await newCheck('verify', bad.id), bad.id, {
        deepUploads: true,
      });
      expect(bad.appProperties.sgbkVerified).toBe('failed');
    });

    it('reads the just-uploaded local copy only when Drive has the same MD5', async () => {
      const file = await addBackup('b1');
      const local = join(work, 'b1.sgbk.part');
      writeFileSync(local, file.data!);
      const download = jest.spyOn(drive, 'downloadFile');
      const md5 = createHash('md5').update(file.data!).digest('hex');
      file.md5Checksum = md5;

      const id = await newCheck('verify', file.id);
      expect(
        await service.verify(id, file.id, {
          deepUploads: false,
          localCopy: { path: local, md5 },
        }),
      ).toBe('succeeded');
      expect(download).not.toHaveBeenCalled();
      expect(check(id).report).toMatchObject({ readFrom: 'local-copy' });

      // A different MD5 in Drive: the local file is not trusted, Drive is read.
      const again = await newCheck('verify', file.id);
      await service.verify(again, file.id, {
        deepUploads: false,
        localCopy: { path: local, md5: 'something-else' },
      });
      expect(download).toHaveBeenCalled();
      expect(check(again).report).toMatchObject({ readFrom: 'drive' });
    });

    it('fails a corrupted database file without throwing', async () => {
      const file = await addBackup('b1');
      file.data![file.data!.length - 10] ^= 0xff;
      const id = await newCheck('verify', file.id);
      expect(await service.verify(id, file.id, { deepUploads: true })).toBe(
        'failed',
      );
      expect(check(id).error).toMatch(/authentication failed|corrupt/i);
    });

    it('fails when an uploaded file is missing or corrupt', async () => {
      const file = await addBackup('b1', { uploads: true });
      const [blob] = drive.byKind(BLOB_KIND);
      blob.data![blob.data!.length - 3] ^= 0xff;
      const deep = await newCheck('verify', file.id);
      expect(await service.verify(deep, file.id, { deepUploads: true })).toBe(
        'failed',
      );
      expect(check(deep).error).toMatch(/0 missing, 1 corrupt/);

      // Light mode (automatic check) only sees presence: corrupt passes, missing fails.
      const light = await newCheck('verify', file.id);
      expect(await service.verify(light, file.id, { deepUploads: false })).toBe(
        'succeeded',
      );
      drive.files.delete(blob.id);
      const light2 = await newCheck('verify', file.id);
      expect(
        await service.verify(light2, file.id, { deepUploads: false }),
      ).toBe('failed');
    });

    it('fails for a file outside the backup folders', async () => {
      const stray = drive.add({
        name: 'x',
        parents: ['elsewhere0001'],
        appProperties: {},
      });
      const id = await newCheck('verify', stray.id);
      expect(await service.verify(id, stray.id, { deepUploads: true })).toBe(
        'failed',
      );
      expect(check(id).error).toMatch(/not found/i);
    });
  });

  describe('test restore', () => {
    it('restores into <live>_restore only and compares with the live data', async () => {
      const file = await addBackup('b1');
      const id = await newCheck('test-restore', file.id);
      await service.testRestore(id, file.id);

      expect(service.testDatabaseName()).toBe('skyGalaxy_restore');
      const slot = client.dbs.get('skyGalaxy_restore')!;
      expect(slot.collections.get('orders')!.docs).toHaveLength(3);
      expect(live.dropped).toBe(0); // the live database is never touched
      expect(check(id)).toMatchObject({ status: 'succeeded' });
      expect(check(id).report).toMatchObject({
        dbName: 'skyGalaxy_restore',
        totalDocs: 4,
        comparison: [
          { collection: 'orders', backup: 3, restored: 3, live: 5 },
          { collection: 'reviews', backup: 0, restored: 0, live: 4 },
          { collection: 'users', backup: 1, restored: 1, live: 1 },
        ],
      });
      expect(await service.getTestRestore()).toMatchObject({
        dbName: 'skyGalaxy_restore',
        exists: true,
      });
    });

    it('replaces the previous test copy and marks it dropped', async () => {
      const file = await addBackup('b1');
      const first = await newCheck('test-restore', file.id);
      await service.testRestore(first, file.id);
      const second = await newCheck('test-restore', file.id);
      await service.testRestore(second, file.id);
      expect(check(first).dropped).toBe(true);
      expect(check(second).status).toBe('succeeded');
      expect(
        client.dbs.get('skyGalaxy_restore')!.collections.get('orders')!.docs,
      ).toHaveLength(3);
    });

    it('writes nothing when the backup fails verification', async () => {
      const file = await addBackup('b1');
      file.data![file.data!.length - 10] ^= 0xff;
      const id = await newCheck('test-restore', file.id);
      await service.testRestore(id, file.id);
      expect(check(id).status).toBe('failed');
      expect(client.dbs.has('skyGalaxy_restore')).toBe(false);
    });

    it('refuses when the live database is larger than the limit', async () => {
      maxBytes = 10;
      const file = await addBackup('b1');
      const id = await newCheck('test-restore', file.id);
      await service.testRestore(id, file.id);
      expect(check(id).status).toBe('failed');
      expect(check(id).error).toMatch(/BACKUP_TEST_RESTORE_MAX_MB/);
      expect(client.dbs.has('skyGalaxy_restore')).toBe(false);
    });

    it('drops only the test database', async () => {
      const file = await addBackup('b1');
      const id = await newCheck('test-restore', file.id);
      await service.testRestore(id, file.id);
      expect(await service.dropTestDatabase()).toEqual({
        dbName: 'skyGalaxy_restore',
      });
      expect(client.dbs.get('skyGalaxy_restore')!.collections.size).toBe(0);
      expect(live.collections.size).toBe(3);
      expect(check(id).dropped).toBe(true);
    });

    it('drops the test database once it is older than its lifetime', async () => {
      const file = await addBackup('b1');
      const id = await newCheck('test-restore', file.id);
      await service.testRestore(id, file.id);
      const finished = check(id).finishedAt as Date;
      const hour = 60 * 60 * 1000;

      const early = new Date(finished.getTime() + hour);
      expect(await service.dropExpiredTestDatabase(24 * hour, early)).toBe(
        false,
      );
      expect(client.dbs.get('skyGalaxy_restore')!.collections.size).toBe(2);

      const late = new Date(finished.getTime() + 25 * hour);
      expect(await service.dropExpiredTestDatabase(24 * hour, late)).toBe(true);
      expect(client.dbs.get('skyGalaxy_restore')!.collections.size).toBe(0);
      expect(check(id).dropped).toBe(true);
      // Already dropped: nothing more to do.
      expect(await service.dropExpiredTestDatabase(24 * hour, late)).toBe(
        false,
      );
    });

    it('never replaces or drops a test database an API instance has run on', async () => {
      const file = await addBackup('b1');
      await service.testRestore(
        await newCheck('test-restore', file.id),
        file.id,
      );
      // Someone switched MONGODB_DB_NAME to the slot: an instance marked it live.
      const slot = client.dbs.get('skyGalaxy_restore')!;
      await markLiveDatabase(slot as never);
      slot.seed('orders', 9); // newer live data

      const again = await newCheck('test-restore', file.id);
      await service.testRestore(again, file.id);
      expect(check(again).status).toBe('failed');
      expect(check(again).error).toMatch(/live database/);
      await expect(service.dropTestDatabase()).rejects.toThrow(/live database/);
      expect(slot.dropped).toBe(1); // only the first, legitimate replacement
      expect(slot.collections.get('orders')!.docs).toHaveLength(9);
      expect(await service.getTestRestore()).toMatchObject({
        exists: true,
        inUseAsLive: true,
      });
    });

    it('leaves the live marker out of the comparison', async () => {
      await markLiveDatabase(live as never);
      const file = await addBackup('b1');
      const id = await newCheck('test-restore', file.id);
      await service.testRestore(id, file.id);
      const rows = (
        check(id).report as { comparison: { collection: string }[] }
      ).comparison;
      expect(rows.map((r) => r.collection)).not.toContain(
        LIVE_MARKER_COLLECTION,
      );
    });
  });

  describe('restore uploaded files', () => {
    let target: string;
    const readTarget = (rel: string) => readFileSync(join(target, rel), 'utf8');
    const restoreCheck = async (
      mode: 'preview' | 'restore' | 'overwrite',
      fileId: string,
    ) => {
      const id = await service.createCheck({
        kind: 'restore-uploads',
        fileId,
        trigger: 'manual',
        mode,
      });
      await service.restoreUploadedFiles(id, fileId, mode);
      return check(id);
    };

    beforeEach(() => {
      target = join(work, 'live-uploads');
      mkdirSync(join(target, 'Product'), { recursive: true });
      jest.spyOn(service, 'uploadsRoot').mockReturnValue(target);
    });

    it('preview reports what would happen and writes nothing', async () => {
      const file = await addBackup('b1', { uploads: true });
      const c = await restoreCheck('preview', file.id);
      expect(c).toMatchObject({
        status: 'succeeded',
        mode: 'preview',
        report: { files: 1, restored: 1, conflictsCount: 0, dryRun: true },
      });
      expect(existsSync(join(target, 'Product/a.webp'))).toBe(false);
    });

    it('restore writes missing files, keeps different ones as conflicts, deletes nothing', async () => {
      const file = await addBackup('b1', { uploads: true });
      writeFileSync(join(target, 'Product/a.webp'), 'edited after the backup');
      writeFileSync(join(target, 'Product/new.webp'), 'not in the backup');
      const c = await restoreCheck('restore', file.id);
      expect(c).toMatchObject({
        status: 'succeeded',
        report: {
          restored: 0,
          conflictsCount: 1,
          conflicts: ['Product/a.webp'],
        },
      });
      expect(readTarget('Product/a.webp')).toBe('edited after the backup');
      expect(readTarget('Product/new.webp')).toBe('not in the backup');

      rmSync(join(target, 'Product/a.webp'));
      const again = await restoreCheck('restore', file.id);
      expect(again.report).toMatchObject({ restored: 1, conflictsCount: 0 });
      expect(readTarget('Product/a.webp')).toBe('a');
      const third = await restoreCheck('restore', file.id);
      expect(third.report).toMatchObject({ restored: 0, unchanged: 1 });
    });

    it('overwrite replaces different files', async () => {
      const file = await addBackup('b1', { uploads: true });
      writeFileSync(join(target, 'Product/a.webp'), 'edited after the backup');
      const c = await restoreCheck('overwrite', file.id);
      expect(c.report).toMatchObject({ restored: 1, conflictsCount: 0 });
      expect(readTarget('Product/a.webp')).toBe('a');
    });

    it('fails when files are missing from Drive, and when there are no uploads', async () => {
      const file = await addBackup('b1', { uploads: true });
      for (const b of drive.byKind(BLOB_KIND)) drive.files.delete(b.id);
      const c = await restoreCheck('restore', file.id);
      expect(c).toMatchObject({
        status: 'failed',
        report: { missingCount: 1 },
      });

      const bare = await addBackup('b2');
      const none = await restoreCheck('restore', bare.id);
      expect(none.status).toBe('failed');
      expect(none.error).toMatch(/no uploaded files/);
    });
  });
});
