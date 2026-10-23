import { RedisLock } from './backup-lock';
import { BACKUP_JOB_OPTIONS, BackupScheduler } from './backup.scheduler';
import { BACKUP_SCHEDULER_ID, DEFAULT_BACKUP_SETTINGS } from './backup.types';

/** Minimal Redis for RedisLock (SET NX PX / EVAL / EXISTS). */
class FakeRedis {
  private store = new Map<string, string>();
  set(key: string, value: string) {
    if (this.store.has(key)) return Promise.resolve(null);
    this.store.set(key, value);
    return Promise.resolve('OK');
  }
  exists(key: string) {
    return Promise.resolve(this.store.has(key) ? 1 : 0);
  }
  eval(script: string, _n: number, key: string, token: string) {
    if (this.store.get(key) !== token) return Promise.resolve(0);
    if (!script.includes('pexpire')) this.store.delete(key);
    return Promise.resolve(1);
  }
}

/** BullMQ queue double that tracks schedulers and detects overlapping syncs. */
class FakeQueue {
  schedulers = new Map<
    string,
    { pattern: string; tz: string; template: unknown }
  >();
  upserts = 0;
  inFlight = 0;
  maxInFlight = 0;
  private async track<T>(fn: () => T): Promise<T> {
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    await new Promise((r) => setTimeout(r, 5));
    this.inFlight--;
    return fn();
  }
  upsertJobScheduler(
    id: string,
    repeat: { pattern: string; tz: string },
    template: unknown,
  ) {
    return this.track(() => {
      this.upserts++;
      this.schedulers.set(id, { ...repeat, template });
      return {};
    });
  }
  removeJobScheduler(id: string) {
    return this.track(() => this.schedulers.delete(id));
  }
  getJobScheduler(id: string) {
    return Promise.resolve(
      this.schedulers.has(id)
        ? { next: Date.parse('2026-10-13T00:00:00Z') }
        : undefined,
    );
  }
}

function setup(
  over: {
    settings?: Partial<typeof DEFAULT_BACKUP_SETTINGS>;
    serverEnabled?: boolean;
    credentials?: boolean;
    cronOverride?: string;
    queue?: FakeQueue;
    redis?: FakeRedis;
  } = {},
) {
  const queue = over.queue ?? new FakeQueue();
  const redis = over.redis ?? new FakeRedis();
  const settings = {
    ...DEFAULT_BACKUP_SETTINGS,
    enabled: true,
    ...over.settings,
  };
  const store = {
    load: jest.fn(() =>
      Promise.resolve({ settings: { ...settings }, address: null }),
    ),
    resolveTimezone: jest.fn(() =>
      Promise.resolve({
        timezone: 'Asia/Riyadh',
        source: 'store-address',
        countryCode: 'SA',
      }),
    ),
  };
  const config = {
    serverEnabled: over.serverEnabled ?? true,
    credentialsConfigured: over.credentials ?? true,
    cronOverride: over.cronOverride,
  };
  const locks = {
    scheduler: new RedisLock(redis as never, 'lock:sched', 30_000),
    whenReady: jest.fn().mockResolvedValue(true),
  };
  const scheduler = new BackupScheduler(
    queue as never,
    config as never,
    store as never,
    locks as never,
  );
  return { scheduler, queue, store, settings, redis, locks };
}

describe('BackupScheduler.sync', () => {
  it('creates the scheduler with the stable id, derived cron and store timezone', async () => {
    const { scheduler, queue } = setup();
    const state = await scheduler.sync('test');
    expect(state).toMatchObject({ active: true, pattern: '0 3,9,15,21 * * *' });
    expect(queue.schedulers.get(BACKUP_SCHEDULER_ID)).toEqual({
      pattern: '0 3,9,15,21 * * *',
      tz: 'Asia/Riyadh',
      template: {
        name: 'scheduled-backup',
        data: { trigger: 'scheduled' },
        opts: BACKUP_JOB_OPTIONS,
      },
    });
    expect(BACKUP_JOB_OPTIONS.attempts).toBe(3);
    expect(BACKUP_JOB_OPTIONS.backoff.type).toBe('exponential');
  });

  it.each([
    ['server-disabled', { serverEnabled: false }],
    ['credentials-missing', { credentials: false }],
    ['admin-disabled', { settings: { enabled: false } }],
  ])('removes the scheduler when %s', async (reason, over) => {
    const queue = new FakeQueue();
    queue.schedulers.set(BACKUP_SCHEDULER_ID, {
      pattern: 'x',
      tz: 'UTC',
      template: {},
    });
    const { scheduler } = setup({ ...over, queue });
    const state = await scheduler.sync('test');
    expect(state).toMatchObject({ active: false, reason });
    expect(queue.schedulers.size).toBe(0);
  });

  it('updates the same scheduler when the schedule changes (no duplicates)', async () => {
    const queue = new FakeQueue();
    await setup({ queue }).scheduler.sync('first');
    await setup({
      queue,
      settings: { backupsPerDay: 2, scheduleTime: '01:30' },
    }).scheduler.sync('second');
    expect(queue.schedulers.size).toBe(1);
    expect(queue.schedulers.get(BACKUP_SCHEDULER_ID)!.pattern).toBe(
      '30 1,13 * * *',
    );
  });

  it('applies the BACKUP_CRON override', async () => {
    const { scheduler, queue } = setup({ cronOverride: '*/5 * * * *' });
    const state = await scheduler.sync('test');
    expect(state.overridden).toBe(true);
    expect(queue.schedulers.get(BACKUP_SCHEDULER_ID)!.pattern).toBe(
      '*/5 * * * *',
    );
  });

  it('serializes concurrent syncs from several instances', async () => {
    const queue = new FakeQueue();
    const redis = new FakeRedis();
    const instances = Array.from(
      { length: 4 },
      () => setup({ queue, redis }).scheduler,
    );
    await Promise.all(instances.map((s) => s.sync('startup')));
    expect(queue.maxInFlight).toBe(1);
    expect(queue.schedulers.size).toBe(1);
    expect(queue.upserts).toBe(4);
  });

  it('fails loudly (never claims success) when the lock cannot be obtained', async () => {
    const redis = new FakeRedis();
    await redis.set('lock:sched', 'stuck');
    const { scheduler, queue } = setup({ redis });
    jest
      .spyOn(RedisLock.prototype, 'acquireWithWait')
      .mockResolvedValueOnce(null);
    await expect(scheduler.sync('test')).rejects.toThrow(/scheduler lock/);
    expect(queue.schedulers.size).toBe(0);
  });

  it('re-syncs only when the business address changes', async () => {
    const { scheduler } = setup();
    const sync = jest.spyOn(scheduler, 'sync').mockResolvedValue({} as never);
    await scheduler.onSettingsUpdated({ changedKeys: ['siteName'] });
    expect(sync).not.toHaveBeenCalled();
    await scheduler.onSettingsUpdated({
      changedKeys: ['businessAddress', 'siteName'],
    });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('reports the next run from BullMQ', async () => {
    const { scheduler } = setup();
    expect(await scheduler.nextRunAt()).toBeNull();
    await scheduler.sync('test');
    expect(await scheduler.nextRunAt()).toEqual(
      new Date('2026-10-13T00:00:00Z'),
    );
  });
});

describe('BackupScheduler.syncAtStartup', () => {
  it('waits for the Redis connection before the first attempt', async () => {
    const { scheduler, locks } = setup();
    const order: string[] = [];
    locks.whenReady.mockImplementation(() => {
      order.push('ready');
      return Promise.resolve(true);
    });
    jest.spyOn(scheduler, 'sync').mockImplementation(() => {
      order.push('sync');
      return Promise.resolve({} as never);
    });
    await scheduler.syncAtStartup(3, 1, 50);
    expect(locks.whenReady).toHaveBeenCalledWith(50);
    expect(order).toEqual(['ready', 'sync']);
  });

  it('still tries when Redis is not ready in time', async () => {
    const { scheduler, locks } = setup();
    locks.whenReady.mockResolvedValue(false);
    const sync = jest
      .spyOn(scheduler, 'sync')
      .mockResolvedValueOnce({} as never);
    await scheduler.syncAtStartup(3, 1, 50);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('retries until Redis/Mongo are reachable', async () => {
    const { scheduler } = setup();
    const sync = jest
      .spyOn(scheduler, 'sync')
      .mockRejectedValueOnce(new Error("Stream isn't writeable"))
      .mockResolvedValueOnce({} as never);
    await scheduler.syncAtStartup(3, 1);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('gives up quietly after the last attempt', async () => {
    const { scheduler } = setup();
    const sync = jest
      .spyOn(scheduler, 'sync')
      .mockRejectedValue(new Error('down'));
    await expect(scheduler.syncAtStartup(2, 1)).resolves.toBeUndefined();
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
