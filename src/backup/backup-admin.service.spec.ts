import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BackupAdminService } from './backup-admin.service';
import {
  DEFAULT_BACKUP_SETTINGS,
  MANUAL_BACKUP_DEDUP_ID,
} from './backup.types';

const SECRETS = {
  key: 'c2VjcmV0LWtleS1zZWNyZXQta2V5LXNlY3JldC1rZXk=',
  clientSecret: 'GOCSPX-super-secret',
  refreshToken: '1//refresh-token-value',
};

function setup(
  over: {
    serverEnabled?: boolean;
    missing?: string[];
    syncError?: Error;
    lockHeld?: boolean;
    dedupJob?: string | null;
    driveError?: Error;
  } = {},
) {
  let stored = { ...DEFAULT_BACKUP_SETTINGS };
  const store = {
    load: jest.fn(() => Promise.resolve({ settings: stored, address: null })),
    get: jest.fn(() => Promise.resolve(stored)),
    update: jest.fn((patch: Record<string, unknown>) => {
      stored = { ...stored, ...(patch as object) };
      return Promise.resolve(stored);
    }),
    resolveTimezone: jest.fn(() =>
      Promise.resolve({
        timezone: 'Asia/Riyadh',
        source: 'store-address',
        countryCode: 'SA',
      }),
    ),
  };
  const scheduler = {
    sync: jest.fn(() =>
      over.syncError
        ? Promise.reject(over.syncError)
        : Promise.resolve({ active: true }),
    ),
    nextRunAt: jest.fn(() => Promise.resolve(new Date('2026-10-13T00:00:00Z'))),
  };
  const missing = over.missing ?? [];
  const config = {
    serverEnabled: over.serverEnabled ?? true,
    credentialsConfigured: missing.length === 0,
    missingCredentials: () => missing,
    cronOverride: undefined,
    // Present on the real config; must never leak into responses.
    driveCredentials: {
      clientId: 'id',
      clientSecret: SECRETS.clientSecret,
      refreshToken: SECRETS.refreshToken,
    },
    encryptionKey: () => Buffer.from(SECRETS.key, 'base64'),
  };
  const locks = {
    backup: {
      holder: jest.fn(() => Promise.resolve(over.lockHeld ? 'backup' : null)),
    },
  };
  const drive = {
    testConnection: jest.fn(() =>
      over.driveError
        ? Promise.reject(over.driveError)
        : Promise.resolve({ folderId: 'folder-1', folderExists: true }),
    ),
  };
  const audit = { log: jest.fn().mockResolvedValue({}) };
  const queue = {
    add: jest.fn().mockResolvedValue({ id: 'job-9' }),
    getJobCounts: jest.fn().mockResolvedValue({ active: 0, waiting: 0 }),
    getDeduplicationJobId: jest.fn(() =>
      Promise.resolve(over.dedupJob ?? null),
    ),
  };
  const runs: Record<string, unknown>[] = [];
  const query = (value: unknown) => ({
    sort: () => ({ lean: () => Promise.resolve(value) }),
  });
  const runModel = {
    create: jest.fn((doc: Record<string, unknown>) => {
      runs.push(doc);
      return Promise.resolve(doc);
    }),
    findOne: jest.fn((filter: { kind: string; status?: unknown }) =>
      query(
        filter.kind === 'backup' && filter.status === 'succeeded'
          ? {
              finishedAt: new Date('2026-10-12T00:00:00Z'),
              fileName: 'f.sgbk',
              driveFileId: 'drive-1',
              sizeBytes: 2048,
              retainedCount: 6,
              consistency: 'snapshot',
            }
          : null,
      ),
    ),
  };
  const service = new BackupAdminService(
    store as never,
    scheduler as never,
    config as never,
    locks as never,
    { create: () => drive } as never,
    audit as never,
    queue as never,
    runModel as never,
  );
  return { service, store, scheduler, audit, queue, runs, drive };
}

const actor = {
  userId: 'u1',
  email: 'admin@example.com',
  ipAddress: '127.0.0.1',
};
const expectNoSecrets = (value: unknown) => {
  const json = JSON.stringify(value);
  for (const secret of Object.values(SECRETS))
    expect(json).not.toContain(secret);
  expect(json).not.toMatch(/refreshToken|clientSecret|encryptionKey/);
};

describe('BackupAdminService', () => {
  it('returns settings, derived timezone and schedule preview without secrets', async () => {
    const { service } = setup();
    const view = await service.getSettings();
    expect(view.settings).toEqual(DEFAULT_BACKUP_SETTINGS);
    expect(view.timezone.timezone).toBe('Asia/Riyadh');
    expect(view.schedule.runTimes).toEqual([
      '03:00',
      '09:00',
      '15:00',
      '21:00',
    ]);
    expect(view.schedule.upcoming).toHaveLength(3);
    expect(view.options.minBackupsKept).toBe(4);
    expectNoSecrets(view);
  });

  it('passes only the provided fields to the store (partial update) and audits', async () => {
    const { service, store, audit, scheduler } = setup();
    await service.updateSettings({ retentionDays: 30 }, actor);
    expect(store.update).toHaveBeenCalledWith({ retentionDays: 30 });
    expect(scheduler.sync).toHaveBeenCalled();
    const entry = (audit.log.mock.calls as unknown[][])[0][0] as {
      newData: { retentionDays: number };
    };
    expect(entry).toMatchObject({
      action: 'UPDATE_BACKUP_SETTINGS',
      module: 'backup',
      userId: 'u1',
    });
    expect(entry.newData.retentionDays).toBe(30);
    expectNoSecrets(entry);
  });

  it('refuses to enable backups when credentials are missing', async () => {
    const { service, store } = setup({ missing: ['GDRIVE_REFRESH_TOKEN'] });
    await expect(
      service.updateSettings({ enabled: true }, actor),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.updateSettings({ enabled: true }, actor),
    ).rejects.toThrow(/GDRIVE_REFRESH_TOKEN/);
    expect(store.update).not.toHaveBeenCalled();
  });

  it('refuses to enable backups when the server switch is off', async () => {
    const { service } = setup({ serverEnabled: false });
    await expect(
      service.updateSettings({ enabled: true }, actor),
    ).rejects.toThrow(/BACKUP_ENABLED/);
  });

  it('allows disabling without credentials', async () => {
    const { service, store } = setup({ missing: ['BACKUP_ENCRYPTION_KEY'] });
    await service.updateSettings({ enabled: false }, actor);
    expect(store.update).toHaveBeenCalledWith({ enabled: false });
  });

  it('reports a scheduler failure instead of claiming the schedule is active', async () => {
    const { service } = setup({ syncError: new Error('redis down') });
    await expect(
      service.updateSettings({ backupsPerDay: 2 }, actor),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('builds status from run records without secrets', async () => {
    const { service } = setup();
    const status = await service.getStatus();
    expect(status.lastSuccess).toMatchObject({
      driveFileId: 'drive-1',
      sizeBytes: 2048,
    });
    expect(status.retainedCount).toBe(6);
    expect(status.scheduler.nextRunAt).toEqual(
      new Date('2026-10-13T00:00:00Z'),
    );
    expect(status.connection.status).toBe('connected');
    expect(status.lastFailure).toBeNull();
    expectNoSecrets(status);
  });

  it('reports not-configured connection when credentials are missing', async () => {
    const { service } = setup({ missing: ['GDRIVE_CLIENT_ID'] });
    expect((await service.getStatus()).connection.status).toBe(
      'not-configured',
    );
  });

  describe('runNow', () => {
    it('queues a deduplicated manual job', async () => {
      const { service, queue, audit } = setup();
      expect(await service.runNow(actor)).toEqual({
        jobId: 'job-9',
        queued: true,
      });
      const [name, data, opts] = queue.add.mock.calls[0] as unknown[];
      expect(name).toBe('manual-backup');
      expect(data).toEqual({ trigger: 'manual', requestedBy: 'u1' });
      expect(opts).toMatchObject({
        attempts: 3,
        deduplication: { id: MANUAL_BACKUP_DEDUP_ID },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RUN_MANUAL_BACKUP' }),
      );
    });

    it('returns 409 while a backup is running', async () => {
      const { service, queue } = setup({ lockHeld: true });
      await expect(service.runNow(actor)).rejects.toThrow(ConflictException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('returns 409 while a manual backup is queued', async () => {
      const { service, queue } = setup({ dedupJob: 'job-1' });
      await expect(service.runNow(actor)).rejects.toThrow(ConflictException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('refuses when the server is not configured', async () => {
      await expect(
        setup({ serverEnabled: false }).service.runNow(actor),
      ).rejects.toThrow(BadRequestException);
      await expect(
        setup({ missing: ['BACKUP_ENCRYPTION_KEY'] }).service.runNow(actor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('testConnection', () => {
    it('records a successful check', async () => {
      const { service, runs } = setup();
      expect(await service.testConnection(actor)).toMatchObject({
        status: 'connected',
        folderExists: true,
      });
      expect(runs[0]).toMatchObject({
        kind: 'connection-test',
        status: 'succeeded',
      });
    });

    it('returns a sanitized failure', async () => {
      const { service, runs } = setup({
        driveError: new Error(
          'invalid_grant refresh_token=1//leakedTokenValue1234567890',
        ),
      });
      const res = await service.testConnection(actor);
      expect(res.status).toBe('failed');
      expect(JSON.stringify(res)).not.toContain('leakedTokenValue');
      expect(runs[0]).toMatchObject({
        kind: 'connection-test',
        status: 'failed',
      });
    });

    it('is refused when credentials are missing', async () => {
      await expect(
        setup({ missing: ['GDRIVE_CLIENT_ID'] }).service.testConnection(actor),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
