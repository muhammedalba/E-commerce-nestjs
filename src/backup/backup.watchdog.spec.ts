import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FakeMongoDb } from '../../test/backup-fakes';
import { DEFAULT_BACKUP_SETTINGS } from './backup.types';
import { BackupWatchdog } from './backup.watchdog';
import { liveMarkerOf } from './live-marker';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-10-13T12:00:00Z');

function setup(
  over: {
    enabled?: boolean;
    serverEnabled?: boolean;
    perDay?: number;
    lastSuccessAgoMs?: number | null;
    enabledAgoMs?: number | null;
    schedulerExists?: boolean;
    redis?: boolean;
    testRestoreTtlMs?: number | null;
  } = {},
) {
  const db = new FakeMongoDb('skyGalaxy');
  const settings = {
    ...DEFAULT_BACKUP_SETTINGS,
    enabled: over.enabled ?? true,
    backupsPerDay: over.perDay ?? 4,
    enabledAt:
      over.enabledAgoMs == null
        ? null
        : new Date(NOW.getTime() - over.enabledAgoMs),
  };
  const last =
    over.lastSuccessAgoMs == null
      ? null
      : { finishedAt: new Date(NOW.getTime() - over.lastSuccessAgoMs) };
  const scheduler = { sync: jest.fn().mockResolvedValue({ active: true }) };
  const alerts = { send: jest.fn().mockResolvedValue(undefined) };
  const checks = {
    failStale: jest.fn().mockResolvedValue(0),
    dropExpiredTestDatabase: jest.fn().mockResolvedValue(false),
  };
  const queue = {
    getJobScheduler: jest
      .fn()
      .mockResolvedValue(over.schedulerExists === false ? null : { id: 'x' }),
  };
  const runModel = {
    findOne: () => ({
      sort: () => ({ select: () => ({ lean: () => Promise.resolve(last) }) }),
    }),
  };
  const redisStore = new Map<string, string>();
  const redis = {
    set: (k: string, v: string) => {
      if (redisStore.has(k)) return Promise.resolve(null);
      redisStore.set(k, v);
      return Promise.resolve('OK');
    },
  };
  const watchdog = new BackupWatchdog(
    { db } as never,
    {
      serverEnabled: over.serverEnabled ?? true,
      credentialsConfigured: true,
      cronOverride: undefined,
      testRestoreTtlMs:
        'testRestoreTtlMs' in over ? over.testRestoreTtlMs : 24 * HOUR,
    } as never,
    {
      load: () => Promise.resolve({ settings, address: null }),
      resolveTimezone: () =>
        Promise.resolve({ timezone: 'Asia/Riyadh', source: 'fallback' }),
    } as never,
    scheduler as never,
    alerts as never,
    checks as never,
    queue as never,
    runModel as never,
    { get: () => 'test' } as never,
    over.redis === false ? undefined : (redis as never),
  );
  return { watchdog, scheduler, alerts, checks, db };
}

describe('BackupWatchdog', () => {
  it('does nothing while backups are disabled', async () => {
    const { watchdog, scheduler, alerts } = setup({
      enabled: false,
      schedulerExists: false,
      lastSuccessAgoMs: 100 * HOUR,
    });
    expect(await watchdog.check(NOW)).toEqual({ state: 'inactive' });
    expect(scheduler.sync).not.toHaveBeenCalled();
    expect(alerts.send).not.toHaveBeenCalled();
  });

  it('re-applies a schedule that vanished from Redis', async () => {
    const { watchdog, scheduler } = setup({
      schedulerExists: false,
      lastSuccessAgoMs: HOUR,
    });
    expect(await watchdog.check(NOW)).toEqual({
      state: 'ok',
      schedulerRestored: true,
    });
    expect(scheduler.sync).toHaveBeenCalledTimes(1);
  });

  it('is quiet while backups are on time (4/day: up to 2×6 h + 1 h)', async () => {
    const { watchdog, alerts } = setup({ lastSuccessAgoMs: 12 * HOUR });
    expect((await watchdog.check(NOW)).state).toBe('ok');
    expect(alerts.send).not.toHaveBeenCalled();
  });

  it('alerts once when no backup succeeded for too long', async () => {
    const { watchdog, alerts } = setup({ lastSuccessAgoMs: 14 * HOUR });
    expect(await watchdog.check(NOW)).toMatchObject({
      state: 'stale',
      alerted: true,
    });
    expect(alerts.send).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'stale' }),
    );
    // Same period (another instance or the next tick): no second alert.
    expect(await watchdog.check(NOW)).toMatchObject({ alerted: false });
    expect(alerts.send).toHaveBeenCalledTimes(1);
  });

  it('measures from the moment backups were enabled when none succeeded yet', async () => {
    const fresh = setup({ lastSuccessAgoMs: null, enabledAgoMs: HOUR });
    expect((await fresh.watchdog.check(NOW)).state).toBe('ok');

    const never = setup({ lastSuccessAgoMs: null, enabledAgoMs: 30 * HOUR });
    expect(await never.watchdog.check(NOW)).toMatchObject({ state: 'stale' });
    expect(never.alerts.send).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringMatching(/none has succeeded/) as unknown,
      }),
    );
  });

  it('uses the schedule interval (1/day allows 2×24 h + 1 h)', async () => {
    const { watchdog } = setup({ perDay: 1, lastSuccessAgoMs: 40 * HOUR });
    expect((await watchdog.check(NOW)).state).toBe('ok');
  });

  it('de-duplicates in memory when Redis is not available', async () => {
    const { watchdog, alerts } = setup({
      lastSuccessAgoMs: 30 * HOUR,
      redis: false,
    });
    await watchdog.check(NOW);
    await watchdog.check(NOW);
    expect(alerts.send).toHaveBeenCalledTimes(1);
  });

  it('marks the database it runs on as live', async () => {
    const { watchdog, db } = setup();
    await watchdog.markLive();
    expect(await liveMarkerOf(db as never)).not.toBeNull();
  });

  it('fails interrupted checks and drops an expired test database', async () => {
    const { watchdog, checks } = setup();
    await watchdog.housekeeping(NOW);
    expect(checks.failStale).toHaveBeenCalledWith(12 * HOUR, NOW);
    expect(checks.dropExpiredTestDatabase).toHaveBeenCalledWith(24 * HOUR, NOW);

    const keep = setup({ testRestoreTtlMs: null });
    await keep.watchdog.housekeeping(NOW);
    expect(keep.checks.dropExpiredTestDatabase).not.toHaveBeenCalled();
  });

  it('removes only old leftover temp files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sgbk-temp-'));
    try {
      const old = join(dir, 'old.upload');
      const fresh = join(dir, 'fresh.upload');
      writeFileSync(old, 'x');
      writeFileSync(fresh, 'x');
      const sevenHoursAgo = (Date.now() - 7 * HOUR) / 1000;
      utimesSync(old, sevenHoursAgo, sevenHoursAgo);
      const { watchdog } = setup();
      expect(await watchdog.cleanTempFiles([dir, join(dir, 'missing')])).toBe(
        1,
      );
      expect(existsSync(old)).toBe(false);
      expect(existsSync(fresh)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
