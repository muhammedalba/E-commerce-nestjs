import { DelayedError } from 'bullmq';
import { BackupAlerts } from './backup-alerts';
import { BackupProcessor } from './backup.processor';
import { DEFAULT_BACKUP_SETTINGS } from './backup.types';

function setup(
  over: {
    enabled?: boolean;
    serverEnabled?: boolean;
    lockFree?: boolean;
    backupError?: Error;
    retentionError?: Error;
    mailError?: Error;
    verifyStatus?: 'succeeded' | 'failed';
    holder?: string | null;
  } = {},
) {
  const release = jest.fn().mockResolvedValue(undefined);
  const handle = { signal: new AbortController().signal, release, token: 't' };
  const locks = {
    backup: {
      acquire: jest
        .fn()
        .mockResolvedValue(over.lockFree === false ? null : handle),
      holder: jest.fn().mockResolvedValue(over.holder ?? 'backup'),
    },
  };
  const backupService = {
    createAndUpload: jest.fn(() =>
      over.backupError
        ? Promise.reject(over.backupError)
        : Promise.resolve({
            runId: 'run-1',
            backupId: 'b1',
            fileName: 'f.sgbk',
            driveFileId: 'drive-1',
            folderId: 'folder-1',
            sizeBytes: 123,
            totalDocs: 9,
            localCopy: { path: '/tmp/b1.sgbk.part', md5: 'abc' },
            blobIds: ['blob-1'],
          }),
    ),
    discardLocalCopy: jest.fn().mockResolvedValue(undefined),
    applyRetention: jest.fn(() =>
      over.retentionError
        ? Promise.reject(over.retentionError)
        : Promise.resolve({ deleted: 0, failed: 0, retained: 4 }),
    ),
  };
  const store = {
    get: jest.fn().mockResolvedValue({
      ...DEFAULT_BACKUP_SETTINGS,
      enabled: over.enabled ?? true,
      retentionDays: 30,
    }),
  };
  const config = {
    serverEnabled: over.serverEnabled ?? true,
    alertEmail: 'ops@example.com',
    workerEnabled: true,
  };
  const mailQueue = {
    add: jest.fn((...args: [string, unknown]) =>
      over.mailError
        ? Promise.reject(over.mailError)
        : Promise.resolve({ args }),
    ),
  };
  const roleModel = {
    find: () => ({
      select: () => ({ lean: () => Promise.resolve([{ _id: 'role-1' }]) }),
    }),
  };
  const runModel = { create: jest.fn().mockResolvedValue({}) };
  const checks = {
    createCheck: jest.fn().mockResolvedValue('check-1'),
    verify: jest.fn().mockResolvedValue(over.verifyStatus ?? 'succeeded'),
    testRestore: jest.fn().mockResolvedValue(undefined),
    restoreUploadedFiles: jest.fn().mockResolvedValue(undefined),
    getCheck: jest.fn().mockResolvedValue({ status: 'succeeded' }),
    markFailed: jest.fn().mockResolvedValue(undefined),
    invalidateListing: jest.fn(),
  };
  const processor = new BackupProcessor(
    backupService as never,
    store as never,
    config as never,
    locks as never,
    new BackupAlerts(config as never, mailQueue as never, roleModel as never),
    runModel as never,
    checks as never,
  );
  return {
    processor,
    config,
    backupService,
    locks,
    release,
    mailQueue,
    runModel,
    checks,
  };
}

const job = (
  name = 'scheduled-backup',
  attemptsMade = 0,
  attempts = 3,
  lockWaits = 0,
) =>
  ({
    id: 'job-1',
    name,
    data: {
      trigger: name === 'manual-backup' ? 'manual' : 'scheduled',
      lockWaits,
    },
    attemptsMade,
    opts: { attempts },
    updateData: jest.fn().mockResolvedValue(undefined),
    moveToDelayed: jest.fn().mockResolvedValue(undefined),
  }) as never;

describe('BackupProcessor worker switch', () => {
  it('stops the worker of this instance when BACKUP_WORKER_ENABLED=false', async () => {
    const { processor, config } = setup();
    const close = jest.fn().mockResolvedValue(undefined);
    Object.assign(processor, { _worker: { close } });
    config.workerEnabled = true;
    await processor.onApplicationBootstrap();
    expect(close).not.toHaveBeenCalled();
    config.workerEnabled = false;
    await processor.onApplicationBootstrap();
    expect(close).toHaveBeenCalled();
  });
});

describe('BackupProcessor.process', () => {
  it('backs up, then applies retention, then releases the lock', async () => {
    const { processor, backupService, release } = setup();
    const result = await processor.process(job());
    expect(result).toEqual({
      runId: 'run-1',
      driveFileId: 'drive-1',
      sizeBytes: 123,
    });
    expect(backupService.applyRetention).toHaveBeenCalledWith(
      expect.objectContaining({
        retentionDays: 30,
        protectId: 'drive-1',
        folderId: 'folder-1',
      }),
    );
    expect(
      backupService.createAndUpload.mock.invocationCallOrder[0],
    ).toBeLessThan(backupService.applyRetention.mock.invocationCallOrder[0]);
    expect(release).toHaveBeenCalled();
  });

  it('skips (no duplicate backup) when another backup holds the lock', async () => {
    const { processor, backupService, runModel } = setup({ lockFree: false });
    expect(await processor.process(job('manual-backup'))).toEqual({
      skipped: 'locked',
    });
    expect(backupService.createAndUpload).not.toHaveBeenCalled();
    expect(runModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped', skipReason: 'locked' }),
    );
  });

  it('waits (without using an attempt) while a check or an upload holds the lock', async () => {
    const { processor, backupService, runModel } = setup({
      lockFree: false,
      holder: 'import',
    });
    const j = job() as unknown as {
      updateData: jest.Mock;
      moveToDelayed: jest.Mock;
    };
    await expect(processor.process(j as never, 'tok')).rejects.toBeInstanceOf(
      DelayedError,
    );
    expect(j.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ lockWaits: 1 }),
    );
    expect(j.moveToDelayed).toHaveBeenCalledWith(expect.any(Number), 'tok');
    expect(backupService.createAndUpload).not.toHaveBeenCalled();
    expect(runModel.create).not.toHaveBeenCalled();
  });

  it('gives up (skipped) after waiting too long for the lock', async () => {
    const { processor, runModel } = setup({ lockFree: false, holder: 'check' });
    expect(
      await processor.process(job('scheduled-backup', 0, 3, 120), 'tok'),
    ).toEqual({ skipped: 'locked' });
    expect(runModel.create).toHaveBeenCalled();
  });

  it('skips scheduled jobs when backups were disabled meanwhile', async () => {
    const { processor, backupService, locks } = setup({ enabled: false });
    expect(await processor.process(job())).toEqual({ skipped: 'disabled' });
    expect(locks.backup.acquire).not.toHaveBeenCalled();
    expect(backupService.createAndUpload).not.toHaveBeenCalled();
  });

  it('never runs retention after a failed backup and rethrows for retry', async () => {
    const { processor, backupService, release } = setup({
      backupError: new Error('upload failed'),
    });
    await expect(processor.process(job())).rejects.toThrow('upload failed');
    expect(backupService.applyRetention).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });

  it('keeps the backup successful when retention fails', async () => {
    const { processor } = setup({ retentionError: new Error('Drive 403') });
    await expect(processor.process(job())).resolves.toMatchObject({
      driveFileId: 'drive-1',
    });
  });
});

describe('BackupProcessor.onFailed', () => {
  it('does not alert on intermediate attempts', async () => {
    const { processor, mailQueue } = setup();
    await processor.onFailed(job('scheduled-backup', 1, 3), new Error('x'));
    await processor.onFailed(job('scheduled-backup', 2, 3), new Error('x'));
    expect(mailQueue.add).not.toHaveBeenCalled();
  });

  it('alerts once after the final attempt, with a sanitized error', async () => {
    const { processor, mailQueue } = setup();
    await processor.onFailed(
      job('scheduled-backup', 3, 3),
      new Error('auth failed refresh_token=1//secretTokenValue123456789'),
    );
    const names = mailQueue.add.mock.calls.map((c) => c[0]);
    expect(names).toEqual(['backup-failed', 'admin-role-notification']);
    const payload = mailQueue.add.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      email: 'ops@example.com',
      jobId: 'job-1',
      attemptsMade: 3,
    });
    expect(JSON.stringify(mailQueue.add.mock.calls)).not.toContain(
      'secretTokenValue',
    );
  });

  it('swallows alert delivery failures (original failure already recorded)', async () => {
    const { processor } = setup({ mailError: new Error('redis down') });
    await expect(
      processor.onFailed(job('manual-backup', 3, 3), new Error('x')),
    ).resolves.toBeUndefined();
  });
});

const checkJob = (
  name: 'verify-backup' | 'test-restore' | 'restore-uploads',
  attemptsMade = 0,
  attempts = 5,
) =>
  ({
    id: 'job-2',
    name,
    data: {
      checkId: 'check-9',
      fileId: 'fakeDriveId000001',
      mode: 'overwrite',
    },
    attemptsMade,
    opts: { attempts },
    updateData: jest.fn().mockResolvedValue(undefined),
    moveToDelayed: jest.fn().mockResolvedValue(undefined),
  }) as never;

describe('BackupProcessor: automatic verification', () => {
  it('verifies every new backup (light uploads check) before retention', async () => {
    const { processor, checks, backupService } = setup();
    await processor.process(job());
    expect(checks.createCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'verify',
        fileId: 'drive-1',
        trigger: 'auto',
      }),
    );
    expect(checks.verify).toHaveBeenCalledWith('check-1', 'drive-1', {
      deepUploads: false,
      signal: expect.any(AbortSignal) as AbortSignal,
      // Read from the MD5-matched upload copy; blobs the backup just listed.
      localCopy: { path: '/tmp/b1.sgbk.part', md5: 'abc' },
      knownBlobs: new Set(['blob-1']),
    });
    expect(backupService.discardLocalCopy).toHaveBeenCalled();
    // Retention then knows whether the new backup can be trusted.
    expect(checks.verify.mock.invocationCallOrder[0]).toBeLessThan(
      backupService.applyRetention.mock.invocationCallOrder[0],
    );
  });

  it('alerts (without failing the job) when the new backup fails verification', async () => {
    const { processor, mailQueue } = setup({ verifyStatus: 'failed' });
    await expect(processor.process(job())).resolves.toMatchObject({
      driveFileId: 'drive-1',
    });
    const [name, data] = mailQueue.add.mock.calls[0] as [
      string,
      { reason: string },
    ];
    expect(name).toBe('backup-failed');
    expect(data.reason).toMatch(/FAILED verification/);
    expect(mailQueue.add.mock.calls[1][1]).toMatchObject({
      action: 'DATABASE_BACKUP_UNVERIFIED',
    });
  });

  it('does not verify when the backup failed', async () => {
    const { processor, checks } = setup({ backupError: new Error('x') });
    await expect(processor.process(job())).rejects.toThrow('x');
    expect(checks.verify).not.toHaveBeenCalled();
  });
});

describe('BackupProcessor: verify / test-restore jobs', () => {
  it('runs a deep verification under the backup lock', async () => {
    const { processor, checks, release } = setup();
    expect(await processor.process(checkJob('verify-backup'))).toEqual({
      checkId: 'check-9',
      status: 'succeeded',
    });
    expect(checks.verify).toHaveBeenCalledWith('check-9', 'fakeDriveId000001', {
      deepUploads: true,
      signal: expect.any(AbortSignal) as AbortSignal,
    });
    expect(release).toHaveBeenCalled();
  });

  it('runs a test restore', async () => {
    const { processor, checks } = setup();
    await processor.process(checkJob('test-restore'));
    expect(checks.testRestore).toHaveBeenCalledWith(
      'check-9',
      'fakeDriveId000001',
      {
        signal: expect.any(AbortSignal) as AbortSignal,
      },
    );
  });

  it('restores uploaded files with the requested mode', async () => {
    const { processor, checks } = setup();
    await processor.process(checkJob('restore-uploads'));
    expect(checks.restoreUploadedFiles).toHaveBeenCalledWith(
      'check-9',
      'fakeDriveId000001',
      'overwrite',
      { signal: expect.any(AbortSignal) as AbortSignal },
    );
  });

  it('waits for the lock (postponed, not failed) while a backup runs', async () => {
    const { processor, checks } = setup({ lockFree: false });
    await expect(
      processor.process(checkJob('verify-backup'), 'tok'),
    ).rejects.toBeInstanceOf(DelayedError);
    expect(checks.verify).not.toHaveBeenCalled();
  });

  it('marks the check failed after the last attempt, without emailing', async () => {
    const { processor, checks, mailQueue } = setup();
    await processor.onFailed(
      checkJob('verify-backup', 2, 5),
      new Error('busy'),
    );
    expect(checks.markFailed).not.toHaveBeenCalled();
    await processor.onFailed(
      checkJob('verify-backup', 5, 5),
      new Error('busy'),
    );
    expect(checks.markFailed).toHaveBeenCalledWith(
      'check-9',
      expect.any(Error),
    );
    expect(mailQueue.add).not.toHaveBeenCalled();
  });
});
