import { Readable, Writable } from 'stream';
import { ReadStream, existsSync, readFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { mongo } from 'mongoose';
import {
  BackupDecryptStream,
  BackupEncryptStream,
  BackupPayloadValidator,
  LineSplitter,
  parseRecord,
} from './backup-format';
import { BACKUP_SPOOL_DIR, BackupService } from './backup.service';
import { BACKUP_KIND_PROPERTY, BACKUP_KIND_VALUE } from './retention';

const KEY = Buffer.alloc(32, 3);
const { ObjectId } = mongo.BSON;

function fakeConnection(docCount = 3, failCursor = false) {
  const db = {
    databaseName: 'skyGalaxy',
    listCollections: () => ({
      toArray: () =>
        Promise.resolve([{ name: 'users', type: 'collection', options: {} }]),
    }),
    collection: () => ({
      listIndexes: () => ({ toArray: () => Promise.resolve([]) }),
      find: () => ({
        async *[Symbol.asyncIterator]() {
          for (let i = 0; i < docCount; i++) {
            await Promise.resolve(); // a network round-trip
            if (failCursor && i === 1)
              throw new Error('network error reading cursor');
            yield { _id: new ObjectId(), i };
          }
        },
        close: () => Promise.resolve(),
      }),
      countDocuments: () => Promise.resolve(docCount),
    }),
  };
  return {
    db,
    getClient: () => ({
      startSession: () => ({ endSession: () => Promise.resolve() }),
    }),
  };
}

function setup(
  opts: {
    docCount?: number;
    failCursor?: boolean;
    uploadError?: Error;
    uploadsError?: Error;
  } = {},
) {
  const uploaded: { bytes: Buffer; params: Record<string, unknown> }[] = [];
  const drive = {
    ensureFolder: jest
      .fn()
      .mockResolvedValue({ id: 'folder-1', created: true, renamed: false }),
    uploadResumable: jest.fn(
      async (
        source: AsyncIterable<Buffer>,
        params: Record<string, unknown>,
      ) => {
        const parts: Buffer[] = [];
        for await (const c of source) parts.push(c);
        if (opts.uploadError) throw opts.uploadError;
        const bytes = Buffer.concat(parts);
        uploaded.push({ bytes, params });
        return {
          id: 'drive-file-1',
          name: String(params.name),
          sizeBytes: bytes.length,
          md5: 'x',
        };
      },
    ),
    listBackups: jest.fn(),
    deleteFile: jest.fn(),
    setAppProperties: jest.fn().mockResolvedValue(undefined),
  };
  const runModel = {
    create: jest.fn().mockResolvedValue({ _id: 'run-1' }),
    updateOne: jest.fn().mockReturnValue({
      catch: () => Promise.resolve(),
      then: (r: (v: unknown) => unknown) => Promise.resolve(r(undefined)),
    }),
  };
  const store = {
    get: jest.fn().mockResolvedValue({
      retentionDays: 14,
      googleDrive: { folderName: 'backups', folderId: '' },
    }),
    setFolderId: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    missingCredentials: () => [],
    encryptionKey: () => KEY,
    batchSize: 100,
    readPreference: 'secondaryPreferred',
    allowNonSnapshot: false,
    decryptionKeys: () => [KEY],
  };
  const uploads = {
    backup: jest.fn(() =>
      opts.uploadsError
        ? Promise.reject(opts.uploadsError)
        : Promise.resolve({
            manifestId: 'manifest-1',
            files: 7,
            totalBytes: 700,
            uploadedBlobs: 2,
            reusedBlobs: 5,
          }),
    ),
    prune: jest.fn(() =>
      Promise.resolve({
        manifestsDeleted: 1,
        blobsDeleted: 2,
        failed: 0,
        blobCleanupSkipped: false,
      }),
    ),
  };
  const service = new BackupService(
    fakeConnection(opts.docCount, opts.failCursor) as never,
    runModel as never,
    config as never,
    store as never,
    { create: () => drive } as never,
    uploads as never,
  );
  return { service, drive, runModel, store, uploaded, uploads };
}

const lastRunUpdate = (runModel: { updateOne: jest.Mock }) =>
  (
    runModel.updateOne.mock.calls as [
      unknown,
      { $set: Record<string, unknown> },
    ][]
  ).at(-1)?.[1]?.$set as Record<string, unknown>;

/** Leftover temp files of this test run's backups. */
const spoolFiles = () =>
  existsSync(BACKUP_SPOOL_DIR)
    ? readdirSync(BACKUP_SPOOL_DIR).filter((f) => f.endsWith('.part'))
    : [];

describe('BackupService.createAndUpload', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uploads a complete, decryptable backup and records success', async () => {
    const { service, uploaded, runModel, store, drive } = setup({
      docCount: 3,
    });
    const outcome = await service.createAndUpload({
      trigger: 'manual',
      jobId: 'j1',
    });

    expect(outcome).toMatchObject({
      driveFileId: 'drive-file-1',
      folderId: 'folder-1',
      totalDocs: 3,
    });
    expect(store.setFolderId).toHaveBeenCalledWith('folder-1');
    expect(uploaded[0].params.appProperties).toMatchObject({
      [BACKUP_KIND_PROPERTY]: BACKUP_KIND_VALUE,
      sgbkStatus: 'partial',
    });
    // Complete only once the uploads were saved too.
    expect(drive.setAppProperties).toHaveBeenCalledWith('drive-file-1', {
      sgbkStatus: 'complete',
    });
    expect(lastRunUpdate(runModel)).toMatchObject({
      status: 'succeeded',
      driveFileId: 'drive-file-1',
      totalDocs: 3,
      consistency: 'snapshot',
    });

    // The uploaded bytes are a valid SGBK file containing the whole export.
    const validator = new BackupPayloadValidator();
    await pipeline(
      Readable.from([uploaded[0].bytes]),
      new BackupDecryptStream([KEY]),
      createGunzip(),
      new LineSplitter(),
      new Writable({
        objectMode: true,
        write(line: string, _e, cb) {
          validator.accept(parseRecord(line));
          cb();
        },
      }),
    );
    expect(validator.assertComplete().totalDocs).toBe(3);
  });

  it('records failure and rethrows when the upload fails', async () => {
    const { service, runModel } = setup({
      uploadError: new Error('Drive 500 access_token=abc'),
    });
    await expect(
      service.createAndUpload({ trigger: 'scheduled' }),
    ).rejects.toThrow('Drive 500');
    const update = lastRunUpdate(runModel);
    expect(update.status).toBe('failed');
    expect(update.error).not.toContain('abc');
  });

  let spoolBefore: string[] = [];
  const spoolAtStart = spoolFiles();
  beforeEach(() => (spoolBefore = spoolFiles()));
  // Successful runs leave their copy to the caller (the processor removes it).
  afterAll(() => {
    for (const f of spoolFiles()) {
      if (!spoolAtStart.includes(f))
        rmSync(join(BACKUP_SPOOL_DIR, f), { force: true });
    }
  });

  it('finishes the export (snapshot read) before the upload starts, and hands the uploaded copy to the caller', async () => {
    const { service, drive, uploaded } = setup({ docCount: 3 });
    const outcome = await service.createAndUpload({ trigger: 'manual' });
    const [source] = drive.uploadResumable.mock.calls[0];
    expect(source).toBeInstanceOf(ReadStream); // a finished temp file, not the live export
    // The local copy is exactly what Drive received, until the caller drops it.
    expect(readFileSync(outcome.localCopy.path)).toEqual(uploaded[0].bytes);
    await service.discardLocalCopy(outcome);
    expect(spoolFiles()).toEqual(spoolBefore);
  });

  it('fails without uploading when the export breaks mid-way, and removes the temp file', async () => {
    const { service, runModel, uploaded } = setup({
      docCount: 3,
      failCursor: true,
    });
    await expect(
      service.createAndUpload({ trigger: 'scheduled' }),
    ).rejects.toThrow('network error reading cursor');
    expect(uploaded).toHaveLength(0);
    expect(lastRunUpdate(runModel).status).toBe('failed');
    expect(spoolFiles()).toEqual(spoolBefore);
  });

  it('fails when encryption finalization fails', async () => {
    jest
      .spyOn(BackupEncryptStream.prototype, '_flush')
      .mockImplementation((cb) => cb(new Error('cipher final failed')));
    const { service, runModel, uploaded } = setup();
    await expect(
      service.createAndUpload({ trigger: 'manual' }),
    ).rejects.toThrow('cipher final failed');
    expect(uploaded).toHaveLength(0);
    expect(lastRunUpdate(runModel).status).toBe('failed');
  });

  it('backs up the uploads after the database file and records them', async () => {
    const { service, uploads, runModel } = setup();
    await service.createAndUpload({ trigger: 'manual' });
    expect(uploads.backup).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 'folder-1', key: KEY }),
    );
    expect(lastRunUpdate(runModel)).toMatchObject({
      status: 'succeeded',
      uploads: { files: 7, uploadedBlobs: 2 },
    });
  });

  it('fails the run when the uploads backup fails', async () => {
    const { service, runModel, drive } = setup({
      uploadsError: new Error('disk read error'),
    });
    await expect(
      service.createAndUpload({ trigger: 'manual' }),
    ).rejects.toThrow(/uploads backup failed: Error: disk read error/);
    expect(lastRunUpdate(runModel).status).toBe('failed');
    // The database file stays "partial": retention won't count it as trusted.
    expect(drive.setAppProperties).not.toHaveBeenCalled();
  });

  it('refuses to run without credentials', async () => {
    const { runModel } = setup();
    const service = new BackupService(
      fakeConnection() as never,
      runModel as never,
      { missingCredentials: () => ['GDRIVE_REFRESH_TOKEN'] } as never,
      {} as never,
      { create: () => ({}) } as never,
      {} as never,
    );
    await expect(
      service.createAndUpload({ trigger: 'manual' }),
    ).rejects.toThrow(/GDRIVE_REFRESH_TOKEN/);
  });
});

describe('BackupService.applyRetention', () => {
  const day = 24 * 60 * 60 * 1000;
  const file = (id: string, ageDays: number) => ({
    id,
    name: `${id}.sgbk`,
    size: '10',
    createdTime: new Date(Date.now() - ageDays * day).toISOString(),
    appProperties: { [BACKUP_KIND_PROPERTY]: BACKUP_KIND_VALUE },
  });

  it('deletes expired backups, keeps the newest four and counts failures', async () => {
    const { service, drive, runModel } = setup();
    drive.listBackups.mockResolvedValue([
      file('new', 0),
      file('a', 1),
      file('b', 2),
      file('c', 3),
      file('old1', 20),
      file('old2', 30),
    ]);
    drive.deleteFile.mockImplementation((id: string) =>
      id === 'old2' ? Promise.reject(new Error('403')) : Promise.resolve(),
    );
    const result = await service.applyRetention({
      runId: 'run-1',
      folderId: 'folder-1',
      retentionDays: 14,
      protectId: 'new',
    });
    expect(
      (drive.deleteFile.mock.calls as string[][]).map((c) => c[0]).sort(),
    ).toEqual(['old1', 'old2']);
    expect(result).toEqual({ deleted: 1, failed: 1, retained: 5 });
    expect(lastRunUpdate(runModel)).toMatchObject({
      retainedCount: 5,
      retention: { uploadManifestsDeleted: 1, uploadBlobsDeleted: 2 },
    });
  });
});
