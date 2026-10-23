import { EventEmitter } from 'events';
import { BackupLocks } from './backup.locks';

const config = { get: () => 'test' };

/** Just enough of an ioredis client: a status and the 'ready' event. */
function fakeRedis(status: string) {
  return Object.assign(new EventEmitter(), { status });
}

const locksFor = (redis?: ReturnType<typeof fakeRedis>) =>
  new BackupLocks(config as never, redis as never);

describe('BackupLocks.whenReady', () => {
  it('resolves true at once when the client is already connected', async () => {
    await expect(locksFor(fakeRedis('ready')).whenReady(10)).resolves.toBe(
      true,
    );
  });

  it('waits for the ready event while the client is connecting', async () => {
    const redis = fakeRedis('connecting');
    const ready = locksFor(redis).whenReady(1_000);
    redis.emit('ready');
    await expect(ready).resolves.toBe(true);
    expect(redis.listenerCount('ready')).toBe(0);
  });

  it('resolves false after the timeout and drops its listener', async () => {
    const redis = fakeRedis('connecting');
    await expect(locksFor(redis).whenReady(10)).resolves.toBe(false);
    expect(redis.listenerCount('ready')).toBe(0);
  });

  it('resolves false without Redis', async () => {
    await expect(locksFor(undefined).whenReady(10)).resolves.toBe(false);
  });
});
