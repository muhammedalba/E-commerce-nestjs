import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Redis } from 'ioredis';

/** Deletes the key only if it still holds our token. */
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0`;

/** Extends the expiry only if the key still holds our token. */
const RENEW_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0`;

export class LockUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockUnavailableError';
  }
}

/** A held lock. `signal` aborts if the lease is lost before release. */
export interface LockHandle {
  readonly token: string;
  readonly signal: AbortSignal;
  release(): Promise<void>;
}

type LockRedis = Pick<Redis, 'set' | 'eval' | 'exists' | 'get'>;

/**
 * Cluster-wide mutual exclusion on one Redis key.
 *
 * - Acquire is atomic (`SET key token PX ttl NX`); the token is random per
 *   acquisition, so only the holder can renew or release (compare-and-act Lua).
 * - The lease is renewed every `ttl / 3`. If a renewal finds the key gone or
 *   owned by someone else — or renewals keep failing until the lease may have
 *   expired — `signal` aborts so the holder stops instead of running unlocked.
 * - A crashed holder stops renewing; its lease expires after `ttl`.
 * - Fails closed: if Redis cannot be reached, acquire throws
 *   {@link LockUnavailableError} rather than proceeding without a lock.
 */
export class RedisLock {
  private readonly logger = new Logger(RedisLock.name);

  constructor(
    private readonly redis: LockRedis | undefined,
    private readonly key: string,
    private readonly ttlMs: number,
  ) {}

  /**
   * Returns a handle, or null when another holder has the lock. `purpose`
   * (letters, digits, dashes) is stored with the token so others can see
   * what holds the lock (see {@link holder}).
   */
  async acquire(purpose = 'lock'): Promise<LockHandle | null> {
    if (!this.redis) throw new LockUnavailableError('Redis is not configured');
    const token = `${purpose.replace(/[^A-Za-z0-9-]/g, '')}:${randomUUID()}`;
    let res: string | null;
    try {
      res = await this.redis.set(this.key, token, 'PX', this.ttlMs, 'NX');
    } catch (err) {
      throw new LockUnavailableError(
        `Could not reach Redis to acquire lock: ${(err as Error).message}`,
      );
    }
    if (res !== 'OK') return null;
    return this.startLease(token);
  }

  /**
   * Retries {@link acquire} until it succeeds or `timeoutMs` elapses —
   * for short critical sections that must wait rather than skip.
   */
  async acquireWithWait(
    timeoutMs: number,
    intervalMs = 250,
    purpose = 'lock',
  ): Promise<LockHandle | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const handle = await this.acquire(purpose);
      if (handle || Date.now() >= deadline) return handle;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  async isHeld(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      return (await this.redis.exists(this.key)) === 1;
    } catch {
      return false;
    }
  }

  /** What currently holds the lock (its `purpose`), or null if free/unknown. */
  async holder(): Promise<string | null> {
    if (!this.redis) return null;
    try {
      const value = await this.redis.get(this.key);
      return value ? value.split(':')[0] : null;
    } catch {
      return null;
    }
  }

  private startLease(token: string): LockHandle {
    const controller = new AbortController();
    let lastRenewed = Date.now();
    let released = false;
    const redis = this.redis!;

    const lose = (reason: string) => {
      if (controller.signal.aborted) return;
      this.logger.error(`Lock ${this.key} lost: ${reason}`);
      controller.abort(new LockUnavailableError(`Lock lost: ${reason}`));
    };

    const timer = setInterval(
      () => {
        void (async () => {
          try {
            const ok = await redis.eval(
              RENEW_SCRIPT,
              1,
              this.key,
              token,
              String(this.ttlMs),
            );
            if (released) return;
            if (ok === 1) lastRenewed = Date.now();
            else lose('lease expired or taken over');
          } catch (err) {
            if (released) return;
            // A missed renewal is tolerable while the lease cannot have lapsed.
            if (Date.now() - lastRenewed > this.ttlMs * 0.8) {
              lose(`renewal failing (${(err as Error).message})`);
            }
          }
        })();
      },
      Math.max(Math.floor(this.ttlMs / 3), 50),
    );
    timer.unref?.();

    return {
      token,
      signal: controller.signal,
      release: async () => {
        if (released) return;
        released = true;
        clearInterval(timer);
        try {
          await redis.eval(RELEASE_SCRIPT, 1, this.key, token);
        } catch (err) {
          // The lease simply expires after ttl.
          this.logger.warn(
            `Lock ${this.key} release failed; it will expire: ${(err as Error).message}`,
          );
        }
      },
    };
  }
}
