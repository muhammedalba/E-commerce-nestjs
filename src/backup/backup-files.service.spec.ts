import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Writable } from 'stream';
import { mongo } from 'mongoose';
import {
  FakeRedis,
  MemoryDrive,
  buildDbBackup,
  memoryModel,
} from '../../test/backup-fakes';
import { BackupFilesService } from './backup-files.service';
import { BackupLocator } from './backup-locator';
import {
  DB_UPLOAD_KIND,
  MANIFEST_UPLOAD_KIND,
  MANUAL_UPLOADS_FOLDER_NAME,
  MANUAL_UPLOADS_FOLDER_ROLE,
} from './backup.types';
import { readBundle, openEntry } from './bundle/bundle';
import { writeTar } from './bundle/tar';
import { BACKUP_KIND_VALUE } from './retention';
import { UploadsBackupService } from './uploads/uploads-backup.service';
import { driveUploadsSource, restoreUploads } from './uploads/restore-uploads';
import {
  BLOB_KIND,
  MANIFEST_KIND,
  sealPayload,
} from './uploads/uploads-format';

const KEY = Buffer.alloc(32, 4);
const FOLDER = 'skygalaxy-db-backups';
const BACKUP_ID = '2026-10-13T09-55-32Z-17ebdf';
const DAY = 24 * 60 * 60 * 1000;

const md5 = (b: Buffer) => createHash('md5').update(b).digest('hex');

async function collect(src: AsyncIterable<Buffer>) {
  const parts: Buffer[] = [];
  for await (const c of src) parts.push(c);
  return Buffer.concat(parts);
}

/** An express-like response that records headers and body. */
class FakeResponse extends Writable {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: Buffer[] = [];
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  setHeader(k: string, v: string) {
    this.headers[k.toLowerCase()] = v;
  }
  _write(chunk: Buffer, _e: BufferEncoding, cb: () => void) {
    this.body.push(chunk);
    cb();
  }
}

/** One "Drive account" with the backup folder, as a server would see it. */
async function makeAccount(opts: { maxBytes?: number } = {}) {
  const drive = new MemoryDrive();
  const folderId = (await drive.ensureFolder(FOLDER)).id;
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
    uploadMaxBytes: opts.maxBytes ?? 50 * 1024 * 1024,
  };
  const release = jest.fn().mockResolvedValue(undefined);
  const locks = {
    backup: {
      acquireWithWait: jest.fn().mockResolvedValue({
        signal: new AbortController().signal,
        release,
      }),
    },
  };
  const redis = new FakeRedis();
  const files = new BackupFilesService(
    config as never,
    locator,
    locks as never,
    { get: () => 'test' } as never,
    redis as never,
  );
  return { drive, folderId, files, redis, locator, locks, release };
}

describe('BackupFilesService', () => {
  let work: string;
  let account: Awaited<ReturnType<typeof makeAccount>>;
  let dbFileId: string;
  let dbBytes: Buffer;

  /** A scheduled backup with two uploaded files, the way the server makes it. */
  async function addBackup(acc = account, backupId = BACKUP_ID) {
    dbBytes = await buildDbBackup({
      key: KEY,
      backupId,
      collections: {
        users: [{ _id: new mongo.ObjectId(), name: 'Sara' }],
        orders: [{ total: 10 }, { total: 20 }],
      },
    });
    const dbFile = acc.drive.add({
      name: `skygalaxy-${backupId}.sgbk`,
      parents: [acc.folderId],
      size: String(dbBytes.length),
      md5Checksum: md5(dbBytes),
      data: dbBytes,
      appProperties: {
        sgbkKind: BACKUP_KIND_VALUE,
        sgbkBackupId: backupId,
        sgbkCreatedAt: new Date().toISOString(),
      },
    });
    const uploads = join(work, `uploads-${backupId}`);
    mkdirSync(join(uploads, 'Product'), { recursive: true });
    writeFileSync(join(uploads, 'Product/a.webp'), 'image-a');
    writeFileSync(join(uploads, 'Product/b.webp'), 'image-b');
    const service = new UploadsBackupService(
      memoryModel('path') as never,
      memoryModel('driveFileId') as never,
    );
    jest.spyOn(service, 'uploadsRoot').mockReturnValue(uploads);
    await service.backup({
      drive: acc.drive,
      folderId: acc.folderId,
      backupId,
      createdAt: new Date(),
      sourceDb: 'skyGalaxy',
      key: KEY,
    });
    return dbFile.id;
  }

  /** Downloads the bundle of `fileId` to a file, like the browser would. */
  async function downloadBundle(fileId = dbFileId) {
    const link = await account.files.createDownloadLink(fileId, 'u1');
    const token = link.path.split('/').pop()!;
    const res = new FakeResponse();
    await account.files.streamBundle(token, res as never);
    const path = join(work, link.fileName);
    writeFileSync(path, Buffer.concat(res.body));
    return { path, res, link };
  }

  beforeEach(async () => {
    work = mkdtempSync(join(tmpdir(), 'sgbk-files-'));
    account = await makeAccount();
    dbFileId = await addBackup();
  });
  afterEach(() => rmSync(work, { recursive: true, force: true }));

  describe('download', () => {
    it('streams a bundle with the database, its manifest and exactly its files', async () => {
      // A blob of some other backup must not be included.
      const blobs = await account.drive.findFolders('uploads-blobs', {
        role: 'upload-blobs',
      });
      account.drive.add({
        name: `${'f'.repeat(64)}.sgbk`,
        parents: [blobs[0].id],
        size: '3',
        data: Buffer.from('xyz'),
        appProperties: { sgbkKind: BLOB_KIND, sgbkBlob: 'f'.repeat(64) },
      });

      const { path, res, link } = await downloadBundle();
      expect(link.fileName).toBe(`skygalaxy-${BACKUP_ID}.backup.tar`);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/x-tar');
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="skygalaxy-${BACKUP_ID}.backup.tar"`,
      );
      expect(Number(res.headers['content-length'])).toBe(
        readFileSync(path).length,
      );

      const bundle = await readBundle(path);
      expect(bundle.backupId).toBe(BACKUP_ID);
      expect(await collect(openEntry(path, bundle.db))).toEqual(dbBytes);
      expect(bundle.manifest).not.toBeNull();
      expect(bundle.blobs.size).toBe(2);
      expect(bundle.blobs.has('f'.repeat(64))).toBe(false);
    });

    it('makes single-use links and stores only a hash of the token', async () => {
      const link = await account.files.createDownloadLink(dbFileId, 'u1');
      const token = link.path.split('/').pop()!;
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect([...account.redis.store.keys()].join()).not.toContain(token);

      await account.files.streamBundle(token, new FakeResponse() as never);
      await expect(
        account.files.streamBundle(token, new FakeResponse() as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses an expired or unknown link', async () => {
      const link = await account.files.createDownloadLink(dbFileId, 'u1');
      account.redis.store.clear(); // TTL elapsed
      await expect(
        account.files.streamBundle(
          link.path.split('/').pop()!,
          new FakeResponse() as never,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses files that are not backups in our folders', async () => {
      const stray = account.drive.add({
        name: 'notes.txt',
        parents: [account.folderId],
        appProperties: {},
      });
      await expect(
        account.files.createDownloadLink(stray.id, 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        account.files.createDownloadLink('../../etc', 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 409 instead of an incomplete bundle when a file is missing in Drive', async () => {
      for (const b of account.drive.byKind(BLOB_KIND))
        account.drive.files.delete(b.id);
      await expect(
        account.files.prepareBundle(dbFileId),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('upload', () => {
    it('imports a downloaded bundle into another account, files included', async () => {
      const { path } = await downloadBundle();
      const other = await makeAccount();
      const result = await other.files.importUpload(
        path,
        'my backup.tar',
        'u2',
      );
      expect(result).toMatchObject({
        backupId: BACKUP_ID,
        format: 'bundle',
        uploadedFiles: 2,
        uploadedBlobs: 2,
      });

      const [manual] = await other.drive.findFolders(
        MANUAL_UPLOADS_FOLDER_NAME,
        {
          role: MANUAL_UPLOADS_FOLDER_ROLE,
          parentId: other.folderId,
        },
      );
      expect(
        await other.drive.listFiles(manual.id, DB_UPLOAD_KIND),
      ).toHaveLength(1);
      const [manifest] = await other.drive.listFiles(
        manual.id,
        MANIFEST_UPLOAD_KIND,
      );
      expect(other.release).toHaveBeenCalled();

      // The imported files restore byte for byte from the new account.
      const target = join(work, 'restored');
      await restoreUploads({
        source: await driveUploadsSource({
          drive: other.drive,
          manifest,
          backupFolderId: other.folderId,
        }),
        keys: [KEY],
        targetDir: target,
      });
      expect(readFileSync(join(target, 'Product/a.webp'), 'utf8')).toBe(
        'image-a',
      );
    });

    it('removes the file list it sent when the database file fails to upload', async () => {
      const { path } = await downloadBundle();
      const other = await makeAccount();
      const memory = other.drive;
      const upload: MemoryDrive['uploadResumable'] = (source, params) =>
        MemoryDrive.prototype.uploadResumable.call(
          memory,
          source,
          params,
        ) as ReturnType<MemoryDrive['uploadResumable']>;
      jest
        .spyOn(other.drive, 'uploadResumable')
        .mockImplementation(async (source, params) => {
          if (params.appProperties.sgbkKind !== DB_UPLOAD_KIND) {
            return upload(source, params);
          }
          for await (const chunk of source) void chunk; // Drive reads, then fails
          throw new Error('Drive quota exceeded');
        });
      await expect(
        other.files.importUpload(path, 'b.tar', 'u2'),
      ).rejects.toThrow('Drive quota exceeded');
      const [manual] = await other.drive.findFolders(
        MANUAL_UPLOADS_FOLDER_NAME,
        {
          role: MANUAL_UPLOADS_FOLDER_ROLE,
          parentId: other.folderId,
        },
      );
      expect(
        await other.drive.listFiles(manual.id, MANIFEST_UPLOAD_KIND),
      ).toEqual([]);
    });

    it('imports a single .sgbk database file', async () => {
      const path = join(work, 'db.sgbk');
      writeFileSync(path, dbBytes);
      const other = await makeAccount();
      expect(await other.files.importUpload(path, 'db.sgbk')).toMatchObject({
        format: 'file',
        backupId: BACKUP_ID,
        uploadedBlobs: 0,
      });
    });

    it('refuses a backup that is already in Drive', async () => {
      const path = join(work, 'db.sgbk');
      writeFileSync(path, dbBytes);
      await expect(
        account.files.importUpload(path, 'db.sgbk'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it.each([
      [
        'random bytes',
        () => Buffer.from('definitely not a backup at all......'),
      ],
      [
        'an uploads part instead of a database',
        () =>
          sealPayload({
            key: KEY,
            payload: 'upload-manifest',
            id: 'x',
            createdAt: new Date(),
            sourceDb: 'skyGalaxy',
            data: Buffer.from('{}'),
          }),
      ],
      [
        'a backup made with an unknown key',
        () =>
          buildDbBackup({
            key: Buffer.alloc(32, 9),
            backupId: 'other',
            collections: { a: [] },
          }),
      ],
    ])('rejects %s', async (_label, make) => {
      const path = join(work, 'bad.sgbk');
      writeFileSync(path, await make());
      const other = await makeAccount();
      await expect(
        other.files.importUpload(path, 'bad.sgbk'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(other.drive.byKind(DB_UPLOAD_KIND)).toHaveLength(0);
    });

    it('rejects a bundle whose file content was swapped', async () => {
      const { path } = await downloadBundle();
      const bundle = await readBundle(path);
      const [[idA, a], [idB, b]] = [...bundle.blobs.entries()];
      const bytes = readFileSync(path);
      const blobA = bytes.subarray(a.offset, a.offset + a.size);
      const blobB = bytes.subarray(b.offset, b.offset + b.size);
      const forged = join(work, 'forged.tar');
      writeFileSync(
        forged,
        await collect(
          writeTar([
            {
              name: `skygalaxy-${BACKUP_ID}.sgbk`,
              size: dbBytes.length,
              open: () => [dbBytes],
            },
            {
              name: `skygalaxy-${BACKUP_ID}.uploads.sgbk`,
              size: bundle.manifest!.size,
              open: () => [
                bytes.subarray(
                  bundle.manifest!.offset,
                  bundle.manifest!.offset + bundle.manifest!.size,
                ),
              ],
            },
            {
              name: `uploads-blobs/${idA}.sgbk`,
              size: blobB.length,
              open: () => [blobB],
            },
            {
              name: `uploads-blobs/${idB}.sgbk`,
              size: blobA.length,
              open: () => [blobA],
            },
          ]),
        ),
      );
      const other = await makeAccount();
      await expect(
        other.files.importUpload(forged, 'forged.tar'),
      ).rejects.toThrow(/does not match its (content|id)/);
      expect(other.drive.byKind(DB_UPLOAD_KIND)).toHaveLength(0);
    });

    it('rejects a bundle that lacks a listed file', async () => {
      const { path } = await downloadBundle();
      const bundle = await readBundle(path);
      const bytes = readFileSync(path);
      const part = (e: { offset: number; size: number }) =>
        bytes.subarray(e.offset, e.offset + e.size);
      const incomplete = join(work, 'incomplete.tar');
      writeFileSync(
        incomplete,
        await collect(
          writeTar([
            {
              name: `skygalaxy-${BACKUP_ID}.sgbk`,
              size: bundle.db.size,
              open: () => [part(bundle.db)],
            },
            {
              name: `skygalaxy-${BACKUP_ID}.uploads.sgbk`,
              size: bundle.manifest!.size,
              open: () => [part(bundle.manifest!)],
            },
          ]),
        ),
      );
      const other = await makeAccount();
      await expect(
        other.files.importUpload(incomplete, 'x.tar'),
      ).rejects.toThrow(/incomplete/);
    });

    it('refuses files over the size limit', async () => {
      const path = join(work, 'db.sgbk');
      writeFileSync(path, dbBytes);
      const small = await makeAccount({ maxBytes: 10 });
      await expect(
        small.files.importUpload(path, 'db.sgbk'),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('keeps the files of imported bundles during blob cleanup', async () => {
      const { path } = await downloadBundle();
      const other = await makeAccount();
      await other.files.importUpload(path, 'b.tar');
      other.drive.add({
        name: 'skygalaxy-x.sgbk',
        parents: [other.folderId],
        size: '1',
        appProperties: { sgbkKind: BACKUP_KIND_VALUE, sgbkBackupId: 'x' },
      });
      other.drive.backdate(BLOB_KIND, 3 * DAY);
      const service = new UploadsBackupService(
        memoryModel('path') as never,
        memoryModel('driveFileId') as never,
      );
      const result = await service.prune({
        drive: other.drive,
        folderId: other.folderId,
        keys: [KEY],
      });
      expect(result.blobsDeleted).toBe(0);
      expect(other.drive.byKind(BLOB_KIND)).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('only deletes backups uploaded from a device (with their file list)', async () => {
      await expect(
        account.files.deleteUploaded(dbFileId),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const { path } = await downloadBundle();
      const other = await makeAccount();
      const { fileId } = await other.files.importUpload(path, 'b.tar');
      await other.files.deleteUploaded(fileId);
      expect(other.drive.byKind(DB_UPLOAD_KIND)).toHaveLength(0);
      expect(other.drive.byKind(MANIFEST_UPLOAD_KIND)).toHaveLength(0);
      // Shared blobs stay; blob cleanup decides later.
      expect(other.drive.byKind(BLOB_KIND)).toHaveLength(2);
      expect(account.drive.byKind(MANIFEST_KIND)).toHaveLength(1);
    });
  });
});
