import { LockUnavailableError, RedisLock } from './backup-lock';

/** In-memory stand-in for the three Redis commands the lock uses. */
class FakeRedis {
  store = new Map<string, { value: string; expiresAt: number }>();
  failEval = false;

  private live(key: string) {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt <= Date.now()) this.store.delete(key);
    return this.store.get(key);
  }

  set(key: string, value: string, _px: 'PX', ttl: number) {
    if (this.live(key)) return Promise.resolve(null);
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
    return Promise.resolve('OK');
  }

  exists(key: string) {
    return Promise.resolve(this.live(key) ? 1 : 0);
  }

  get(key: string) {
    return Promise.resolve(this.live(key)?.value ?? null);
  }

  eval(script: string, _n: number, key: string, token: string, ttl?: string) {
    if (this.failEval) return Promise.reject(new Error('connection lost'));
    const entry = this.live(key);
    if (!entry || entry.value !== token) return Promise.resolve(0);
    if (script.includes('pexpire')) {
      entry.expiresAt = Date.now() + Number(ttl);
      return Promise.resolve(1);
    }
    this.store.delete(key);
    return Promise.resolve(1);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls instead of a fixed sleep, so timer delays under load don't flake. */
async function waitFor(cond: () => boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!cond() && Date.now() < deadline) await sleep(10);
  return cond();
}

describe('RedisLock', () => {
  it('tells others what holds it', async () => {
    const redis = new FakeRedis();
    const lock = new RedisLock(redis as never, 'k', 1000);
    expect(await lock.holder()).toBeNull();
    const handle = await lock.acquire('import');
    expect(await lock.holder()).toBe('import');
    await handle!.release();
    expect(await lock.holder()).toBeNull();
  });

  it('grants the lock to one holder at a time', async () => {
    const redis = new FakeRedis();
    const a = new RedisLock(redis as never, 'k', 1000);
    const b = new RedisLock(redis as never, 'k', 1000);
    const first = await a.acquire();
    expect(first).not.toBeNull();
    expect(await b.acquire()).toBeNull();
    expect(await b.isHeld()).toBe(true);
    await first!.release();
    const second = await b.acquire();
    expect(second).not.toBeNull();
    await second!.release();
  });

  it('never lets a holder release a lock it no longer owns', async () => {
    const redis = new FakeRedis();
    const lock = new RedisLock(redis as never, 'k', 1000);
    const handle = await lock.acquire();
    // Simulate expiry + takeover by another process.
    redis.store.set('k', {
      value: 'someone-else',
      expiresAt: Date.now() + 10_000,
    });
    await handle!.release();
    expect(redis.store.get('k')?.value).toBe('someone-else');
  });

  it('renews the lease while held', async () => {
    // Fake clock (Date.now + timers): deterministic even under heavy CI load.
    jest.useFakeTimers();
    try {
      const redis = new FakeRedis();
      const lock = new RedisLock(redis as never, 'k', 1500);
      const handle = await lock.acquire();
      await jest.advanceTimersByTimeAsync(5000); // > 3× the ttl: only renewals keep it alive
      expect(await lock.isHeld()).toBe(true);
      expect(handle!.signal.aborted).toBe(false);
      await handle!.release();
      expect(await lock.isHeld()).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('aborts the holder when the lease is taken over', async () => {
    const redis = new FakeRedis();
    const lock = new RedisLock(redis as never, 'k', 150);
    const handle = await lock.acquire();
    redis.store.set('k', { value: 'other', expiresAt: Date.now() + 10_000 });
    expect(await waitFor(() => handle!.signal.aborted)).toBe(true);
    expect(handle!.signal.reason).toBeInstanceOf(LockUnavailableError);
    await handle!.release();
  });

  it('aborts when renewals keep failing past the lease', async () => {
    const redis = new FakeRedis();
    const lock = new RedisLock(redis as never, 'k', 150);
    const handle = await lock.acquire();
    redis.failEval = true;
    expect(await waitFor(() => handle!.signal.aborted)).toBe(true);
    await handle!.release();
  });

  it('a crashed holder (no renewals) loses the lock after the ttl', async () => {
    const redis = new FakeRedis();
    await redis.set('k', 'dead-process', 'PX', 100);
    const lock = new RedisLock(redis as never, 'k', 100);
    expect(await lock.acquire()).toBeNull();
    await sleep(150);
    const handle = await lock.acquire();
    expect(handle).not.toBeNull();
    await handle!.release();
  });

  it('fails closed when Redis is unreachable or missing', async () => {
    const broken = {
      set: () => Promise.reject(new Error('ECONNREFUSED')),
    };
    await expect(
      new RedisLock(broken as never, 'k', 1000).acquire(),
    ).rejects.toBeInstanceOf(LockUnavailableError);
    await expect(
      new RedisLock(undefined, 'k', 1000).acquire(),
    ).rejects.toBeInstanceOf(LockUnavailableError);
  });

  it('acquireWithWait waits for a short critical section', async () => {
    const redis = new FakeRedis();
    const lock = new RedisLock(redis as never, 'k', 1000);
    const first = await lock.acquire();
    setTimeout(() => void first!.release(), 100);
    const second = await lock.acquireWithWait(2000, 20);
    expect(second).not.toBeNull();
    await second!.release();
  });
});
