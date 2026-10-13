import { randomBytes } from 'crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { BackupFormatError } from '../backup-format';
import { verifyBackupFile } from '../restore';
import { UploadsBackupService } from './uploads-backup.service';
import {
  UploadsRestoreError,
  findDriveUploadsSource,
  restoreUploads,
} from './restore-uploads';
import {
  BLOB_KIND,
  MANIFEST_KIND,
  assertSafeRelativePath,
  blobIdFor,
  openPayload,
  parseManifest,
  resolveInside,
  sealPayload,
} from './uploads-format';

const KEY = Buffer.alloc(32, 5);
const FOLDER = 'skygalaxy-db-backups';
const DAY = 24 * 60 * 60 * 1000;
const blobIdOf = (content: string) => blobIdFor(KEY, Buffer.from(content));

import { MemoryDrive, memoryModel } from '../../../test/backup-fakes';

describe('uploads backup', () => {
  /** Restore through the Drive source (what the CLI does). */
  const restoreFromDrive = async (opts: {
    keys: Buffer[];
    targetDir: string;
    backupId?: string;
    overwrite?: boolean;
    dryRun?: boolean;
  }) =>
    restoreUploads({
      ...opts,
      source: await findDriveUploadsSource(drive, FOLDER, opts.backupId),
    });

  let work: string;
  let uploads: string;
  let drive: MemoryDrive;
  let service: UploadsBackupService;
  let index: ReturnType<typeof memoryModel>;
  let manifests: ReturnType<typeof memoryModel>;
  let folderId: string;

  const write = (rel: string, data: Buffer | string) => {
    const abs = join(uploads, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, data);
  };
  const runBackup = (backupId: string) =>
    service.backup({
      drive: drive,
      folderId,
      backupId,
      createdAt: new Date(),
      sourceDb: 'skyGalaxy',
      key: KEY,
    });

  beforeEach(async () => {
    work = mkdtempSync(join(tmpdir(), 'sgbk-uploads-'));
    uploads = join(work, 'uploads');
    mkdirSync(uploads);
    drive = new MemoryDrive();
    folderId = (await drive.ensureFolder(FOLDER)).id;
    index = memoryModel('path');
    manifests = memoryModel('driveFileId');
    service = new UploadsBackupService(index as never, manifests as never);
    jest.spyOn(service, 'uploadsRoot').mockReturnValue(uploads);
  });
  afterEach(() => rmSync(work, { recursive: true, force: true }));

  it('backs up and restores every file byte for byte, encrypted in Drive', async () => {
    const product = randomBytes(5000);
    const receipt = Buffer.from('%PDF-1.7 bank transfer receipt of customer X');
    write('Product/a.webp', product);
    write('Order/2026/receipt.pdf', receipt);
    write('User/avatar.png', randomBytes(300));

    const result = await runBackup('b1');
    expect(result).toMatchObject({
      files: 3,
      uploadedBlobs: 3,
      reusedBlobs: 0,
    });
    expect(drive.byKind(MANIFEST_KIND)).toHaveLength(1);
    for (const blob of drive.byKind(BLOB_KIND)) {
      expect(blob.data!.includes(Buffer.from('bank transfer'))).toBe(false);
      expect(blob.data!.subarray(0, 4).toString()).toBe('SGBK');
    }

    const target = join(work, 'restored');
    const report = await restoreFromDrive({
      keys: [KEY],
      targetDir: target,
    });
    expect(report).toMatchObject({ backupId: 'b1', files: 3, restored: 3 });
    expect(readFileSync(join(target, 'Product/a.webp'))).toEqual(product);
    expect(readFileSync(join(target, 'Order/2026/receipt.pdf'))).toEqual(
      receipt,
    );
  });

  it('is incremental: unchanged files and duplicate contents are not re-uploaded', async () => {
    const same = randomBytes(100);
    write('Product/a.webp', same);
    write('Product/copy-of-a.webp', same);
    write('Brand/b.png', randomBytes(100));
    expect(await runBackup('b1')).toMatchObject({
      uploadedBlobs: 2,
      reusedBlobs: 1,
    });
    expect(await runBackup('b2')).toMatchObject({
      uploadedBlobs: 0,
      reusedBlobs: 3,
    });

    write('Brand/b.png', randomBytes(100));
    utimesSync(
      join(uploads, 'Brand/b.png'),
      new Date(),
      new Date(Date.now() + 5000),
    );
    expect(await runBackup('b3')).toMatchObject({
      uploadedBlobs: 1,
      reusedBlobs: 2,
    });
    expect(drive.byKind(BLOB_KIND)).toHaveLength(3);
  });

  it('restores the files of a chosen older backup', async () => {
    write('Product/a.webp', 'version 1');
    await runBackup('b1');
    write('Product/a.webp', 'version 2 (longer)');
    await runBackup('b2');

    const target = join(work, 'restored');
    await restoreFromDrive({
      keys: [KEY],
      backupId: 'b1',
      targetDir: target,
    });
    expect(readFileSync(join(target, 'Product/a.webp'), 'utf8')).toBe(
      'version 1',
    );
  });

  it('returns null when there is no local uploads folder', async () => {
    rmSync(uploads, { recursive: true });
    expect(await runBackup('b1')).toBeNull();
    expect(drive.byKind(MANIFEST_KIND)).toHaveLength(0);
  });

  it('uploads many files in parallel: same content once, list in path order', async () => {
    for (let i = 0; i < 10; i++) write(`P/${i}.webp`, `image-${i}`);
    write('Q/copy-of-3.webp', 'image-3'); // same content as P/3.webp
    const result = await runBackup('b1');
    expect(result).toMatchObject({
      files: 11,
      uploadedBlobs: 10,
      reusedBlobs: 1,
    });
    expect(drive.byKind(BLOB_KIND)).toHaveLength(10);
    const [manifestFile] = drive.byKind(MANIFEST_KIND);
    const { data } = await openPayload(
      Readable.from([manifestFile.data!]),
      [KEY],
      'upload-manifest',
    );
    const paths = parseManifest(data).files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort());
  });

  it('leaves out (with a warning) files larger than the limit instead of failing', async () => {
    write('Product/a.webp', 'small');
    write('Video/big.mp4', 'x'.repeat(100));
    jest.spyOn(service, 'maxFileBytes').mockReturnValue(50);
    expect(await runBackup('b1')).toMatchObject({
      files: 1,
      skippedTooLarge: ['Video/big.mp4'],
    });
  });

  it('re-reads a file that changed while it was uploaded, so its id stays true', async () => {
    write('Product/a.webp', 'before');
    const memory = drive;
    const upload: MemoryDrive['uploadResumable'] = (source, params) =>
      MemoryDrive.prototype.uploadResumable.call(
        memory,
        source,
        params,
      ) as ReturnType<MemoryDrive['uploadResumable']>;
    let first = true;
    jest
      .spyOn(drive, 'uploadResumable')
      .mockImplementation((source, params) => {
        const isBlob = params.appProperties.sgbkKind === BLOB_KIND;
        if (first && isBlob) {
          first = false;
          write('Product/a.webp', 'after, longer'); // changes before it is read
        }
        return upload(source, params);
      });
    await runBackup('b1');
    const blobs = drive.byKind(BLOB_KIND).map((b) => b.appProperties.sgbkBlob);
    expect(blobs).toEqual([blobIdOf('after, longer')]);
    // The manifest records what was sealed, so a restore accepts it.
    const target = join(work, 'restored');
    await restoreFromDrive({ keys: [KEY], targetDir: target });
    expect(readFileSync(join(target, 'Product/a.webp'), 'utf8')).toBe(
      'after, longer',
    );
  });

  describe('restore safety', () => {
    let target: string;
    beforeEach(async () => {
      write('Product/a.webp', 'original');
      await runBackup('b1');
      target = join(work, 'restored');
      mkdirSync(join(target, 'Product'), { recursive: true });
    });
    const restore = (extra = {}) =>
      restoreFromDrive({
        keys: [KEY],
        targetDir: target,
        ...extra,
      });

    it('keeps identical existing files', async () => {
      writeFileSync(join(target, 'Product/a.webp'), 'original');
      expect(await restore()).toMatchObject({ unchanged: 1, restored: 0 });
    });

    it('reports a conflict instead of overwriting a different file', async () => {
      writeFileSync(join(target, 'Product/a.webp'), 'local edit');
      const err = await restore().catch((e: UploadsRestoreError) => e);
      expect(err).toBeInstanceOf(UploadsRestoreError);
      expect((err as UploadsRestoreError).report?.conflicts).toEqual([
        'Product/a.webp',
      ]);
      expect(readFileSync(join(target, 'Product/a.webp'), 'utf8')).toBe(
        'local edit',
      );

      await restore({ overwrite: true });
      expect(readFileSync(join(target, 'Product/a.webp'), 'utf8')).toBe(
        'original',
      );
    });

    it('writes nothing in a dry run', async () => {
      expect(await restore({ dryRun: true })).toMatchObject({
        restored: 1,
        dryRun: true,
      });
      expect(existsSync(join(target, 'Product/a.webp'))).toBe(false);
    });

    it('never writes a blob whose content does not match the manifest', async () => {
      write('Brand/other.png', 'other content');
      await runBackup('b2');
      const [first, second] = drive.byKind(BLOB_KIND);
      [first.data, second.data] = [second.data, first.data];
      const err = await restore({ backupId: 'b2' }).catch(
        (e: UploadsRestoreError) => e,
      );
      expect(err).toBeInstanceOf(UploadsRestoreError);
      expect((err as UploadsRestoreError).report?.failed.sort()).toEqual([
        'Brand/other.png',
        'Product/a.webp',
      ]);
      expect(existsSync(join(target, 'Product/a.webp'))).toBe(false);
      expect(existsSync(join(target, 'Brand/other.png'))).toBe(false);
    });

    it('records a tampered blob as failed and restores the other files', async () => {
      write('Brand/other.png', 'other content');
      await runBackup('b2');
      const blobs = drive.byKind(BLOB_KIND);
      const bad = blobs.find(
        (b) => b.appProperties.sgbkBlob === blobIdOf('original'),
      )!;
      bad.data![bad.data!.length - 5] ^= 0xff;
      const err = await restore({ backupId: 'b2' }).catch(
        (e: UploadsRestoreError) => e,
      );
      expect((err as UploadsRestoreError).report).toMatchObject({
        restored: 1,
        failed: ['Product/a.webp'],
      });
      expect(existsSync(join(target, 'Product/a.webp'))).toBe(false);
      expect(readFileSync(join(target, 'Brand/other.png'), 'utf8')).toBe(
        'other content',
      );
      // No temp file is left behind.
      expect(readdirSync(join(target, 'Product'))).toEqual([]);
    });

    it('compares existing files without downloading them; a preview downloads nothing', async () => {
      await restore();
      const download = jest.spyOn(drive, 'downloadFile');
      expect(await restore({ dryRun: true })).toMatchObject({
        unchanged: 1,
        restored: 0,
      });
      await expect(restore()).resolves.toMatchObject({ unchanged: 1 });
      // Only the manifest was read each time, never a blob.
      expect(download).toHaveBeenCalledTimes(2);
    });

    it('reports blobs missing from Drive', async () => {
      for (const b of drive.byKind(BLOB_KIND)) drive.files.delete(b.id);
      const err = await restore().catch((e: UploadsRestoreError) => e);
      expect((err as UploadsRestoreError).report?.missing).toEqual([
        'Product/a.webp',
      ]);
    });

    it('refuses the wrong key', async () => {
      await expect(restore({ keys: [Buffer.alloc(32, 9)] })).rejects.toThrow(
        /No configured key/,
      );
    });
  });

  describe('prune', () => {
    const prune = (now = new Date(Date.now() + 2 * DAY)) =>
      service.prune({ drive: drive, folderId, keys: [KEY], now });

    it('drops manifests of deleted database backups and their unreferenced blobs', async () => {
      write('Product/old.webp', 'only in b1');
      drive.addDbBackup(folderId, 'b1');
      await runBackup('b1');
      rmSync(join(uploads, 'Product/old.webp'));
      write('Product/new.webp', 'in b2');
      drive.addDbBackup(folderId, 'b2');
      await runBackup('b2');

      // Database retention removed b1.
      for (const f of drive.dbBackupsOf('b1')) drive.files.delete(f.id);

      const result = await prune();
      expect(result).toMatchObject({
        manifestsDeleted: 1,
        blobsDeleted: 1,
        failed: 0,
      });
      expect(
        drive.byKind(MANIFEST_KIND).map((m) => m.appProperties.sgbkBackupId),
      ).toEqual(['b2']);
      expect(drive.byKind(BLOB_KIND)).toHaveLength(1);

      // b2 is still fully restorable.
      const target = join(work, 'restored');
      await restoreFromDrive({
        keys: [KEY],
        targetDir: target,
      });
      expect(readFileSync(join(target, 'Product/new.webp'), 'utf8')).toBe(
        'in b2',
      );
    });

    it('keeps young unreferenced blobs (grace period)', async () => {
      write('Product/x.webp', 'x');
      drive.addDbBackup(folderId, 'b1');
      await runBackup('b1');
      for (const m of drive.byKind(MANIFEST_KIND)) drive.files.delete(m.id);
      manifests.docs.clear();
      expect(await prune(new Date())).toMatchObject({ blobsDeleted: 0 });
    });

    it('rebuilds the manifest cache from Drive when it is missing', async () => {
      write('Product/x.webp', 'x');
      drive.addDbBackup(folderId, 'b1');
      await runBackup('b1');
      manifests.docs.clear(); // e.g. after moving to a new server
      expect(await prune()).toMatchObject({
        blobsDeleted: 0,
        blobCleanupSkipped: false,
      });
      expect(manifests.docs.size).toBe(1);
    });

    it('never deletes blobs when a remaining manifest is unreadable', async () => {
      write('Product/x.webp', 'x');
      drive.addDbBackup(folderId, 'b1');
      await runBackup('b1');
      manifests.docs.clear();
      const [m] = drive.byKind(MANIFEST_KIND);
      m.data![m.data!.length - 3] ^= 0xff;
      drive.backdate(BLOB_KIND, 3 * DAY);
      const result = await prune();
      expect(result).toMatchObject({
        blobCleanupSkipped: true,
        blobsDeleted: 0,
      });
      expect(drive.byKind(BLOB_KIND)).toHaveLength(1);
    });

    it('does nothing when no database backup is listed', async () => {
      write('Product/x.webp', 'x');
      await runBackup('b1');
      expect(await prune()).toMatchObject({
        manifestsDeleted: 0,
        blobCleanupSkipped: true,
      });
      expect(drive.byKind(MANIFEST_KIND)).toHaveLength(1);
    });
  });
});

describe('uploads format', () => {
  it('rejects unsafe manifest paths', () => {
    for (const bad of [
      '../etc/passwd',
      '/abs',
      'a/../../b',
      'a//b',
      'C:\\x',
      'a\\b',
      '',
      './a',
    ]) {
      expect(() => assertSafeRelativePath(bad)).toThrow(BackupFormatError);
    }
    expect(assertSafeRelativePath('Product/2026/a.webp')).toBe(
      'Product/2026/a.webp',
    );
    expect(() => resolveInside('/tmp/target', '../x')).toThrow();
  });

  it('rejects a manifest containing a traversal path', () => {
    const manifest = {
      formatVersion: 1,
      backupId: 'b1',
      createdAt: '',
      totalBytes: 1,
      files: [{ path: '../../.env', blob: 'a'.repeat(64), size: 1, mtime: '' }],
    };
    expect(() => parseManifest(Buffer.from(JSON.stringify(manifest)))).toThrow(
      /Unsafe path/,
    );
  });

  it('the database restore refuses uploads payloads', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sgbk-payload-'));
    try {
      const file = join(dir, 'manifest.sgbk');
      writeFileSync(
        file,
        await sealPayload({
          key: KEY,
          payload: 'upload-manifest',
          id: 'b1',
          createdAt: new Date(),
          sourceDb: 'skyGalaxy',
          data: Buffer.from('{}'),
        }),
      );
      await expect(verifyBackupFile(file, [KEY])).rejects.toThrow(
        /not a database backup/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
