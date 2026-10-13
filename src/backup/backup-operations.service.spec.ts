import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BackupOperationsService } from './backup-operations.service';

const actor = { userId: 'u1', email: 'a@b.c' };

function setup(over: { inspectError?: Error; importError?: Error } = {}) {
  const files = {
    inspectUpload: jest.fn(() =>
      over.inspectError
        ? Promise.reject(over.inspectError)
        : Promise.resolve({ header: { backupId: 'b1' } }),
    ),
    importInspected: jest.fn(() =>
      over.importError
        ? Promise.reject(over.importError)
        : Promise.resolve({
            fileId: 'fakeDriveId000009',
            backupId: 'b1',
            format: 'bundle',
            uploadedFiles: 2,
            uploadedBlobs: 1,
          }),
    ),
  };
  const checks = {
    createCheck: jest.fn().mockResolvedValue('check-1'),
    markRunning: jest.fn().mockResolvedValue(undefined),
    markSucceeded: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    invalidateListing: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new BackupOperationsService(
    checks as never,
    files as never,
    {} as never,
    { missingCredentials: () => [] } as never,
    audit as never,
    {} as never,
  );
  const queueVerify = jest
    .spyOn(service, 'queueVerify')
    .mockResolvedValue({ checkId: 'verify-1', jobId: 'j1' });
  return { service, files, checks, audit, queueVerify };
}

/** Waits until the background import has removed the temp file. */
async function settle(path: () => string) {
  const deadline = Date.now() + 3000;
  while (existsSync(path()) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('BackupOperationsService.importUpload', () => {
  let dir: string;
  let temp: string;
  const upload = () =>
    ({ path: temp, originalname: 'x.backup.tar', size: 10 }) as never;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sgbk-ops-'));
    temp = join(dir, 'abc.upload');
    writeFileSync(temp, 'ciphertext');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('answers at once with a check, then imports and verifies in the background', async () => {
    const { service, checks, queueVerify, audit } = setup();
    expect(await service.importUpload(upload(), actor)).toEqual({
      checkId: 'check-1',
      jobId: null,
    });
    expect(checks.createCheck).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'import', backupId: 'b1' }),
    );
    await settle(() => temp);
    expect(queueVerify).toHaveBeenCalledWith('fakeDriveId000009', actor);
    expect(checks.markSucceeded).toHaveBeenCalledWith('check-1', {
      driveFileId: 'fakeDriveId000009',
      report: expect.objectContaining({
        backupId: 'b1',
        verifyCheckId: 'verify-1',
      }) as unknown,
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPLOAD_BACKUP' }),
    );
    expect(existsSync(temp)).toBe(false);
  });

  it('rejects a bad file during the request and removes it', async () => {
    const { service, checks } = setup({
      inspectError: new BadRequestException('Not a valid backup file'),
    });
    await expect(service.importUpload(upload(), actor)).rejects.toThrow(
      'Not a valid backup file',
    );
    expect(checks.createCheck).not.toHaveBeenCalled();
    expect(existsSync(temp)).toBe(false);
  });

  it('records a background failure on the check and still removes the file', async () => {
    const { service, checks, queueVerify } = setup({
      importError: new Error('Drive quota exceeded'),
    });
    await service.importUpload(upload(), actor);
    await settle(() => temp);
    expect(checks.markFailed).toHaveBeenCalledWith(
      'check-1',
      expect.stringMatching(/Drive quota exceeded/),
    );
    expect(queueVerify).not.toHaveBeenCalled();
    expect(existsSync(temp)).toBe(false);
  });
});

describe('BackupOperationsService: queuing checks', () => {
  function queueSetup(addedId: (opts: { jobId: string }) => string) {
    const checks = {
      createCheck: jest.fn().mockResolvedValue('check-1'),
      deleteCheck: jest.fn().mockResolvedValue(undefined),
      attachJob: jest.fn().mockResolvedValue(undefined),
    };
    const queue = {
      getDeduplicationJobId: jest.fn().mockResolvedValue(null),
      add: jest.fn((_n: string, _d: unknown, opts: { jobId: string }) =>
        Promise.resolve({ id: addedId(opts) }),
      ),
    };
    const locator = {
      drive: () => ({}),
      resolveDbFile: jest.fn().mockResolvedValue({ backupId: 'b1' }),
    };
    const service = new BackupOperationsService(
      checks as never,
      {} as never,
      locator as never,
      { missingCredentials: () => [] } as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      queue as never,
    );
    return { service, checks, queue };
  }

  it('queues one job per check, with an id derived from the check', async () => {
    const { service, checks } = queueSetup((o) => o.jobId);
    expect(await service.queueVerify('fakeDriveId000001', actor)).toEqual({
      checkId: 'check-1',
      jobId: 'check-check-1',
    });
    expect(checks.attachJob).toHaveBeenCalledWith('check-1', 'check-check-1');
  });

  it('removes its check and answers 409 when a simultaneous request won', async () => {
    // BullMQ deduplicated the add: it returns the other request's job.
    const { service, checks } = queueSetup(() => 'check-other');
    await expect(
      service.queueVerify('fakeDriveId000001', actor),
    ).rejects.toThrow(/already being verified/);
    expect(checks.deleteCheck).toHaveBeenCalledWith('check-1');
    expect(checks.attachJob).not.toHaveBeenCalled();
  });
});
