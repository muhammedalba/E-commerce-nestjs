import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * Resources whose cached responses embed data of another resource.
 * Product responses populate category / sub-category / brand / supplier names,
 * so changing any of those must also drop cached product responses.
 */
const DEPENDENT_RESOURCES: Record<string, string[]> = {
  categories: ['products'],
  'sub-category': ['products'],
  brands: ['products'],
  supplier: ['products'],
};

type KeyvLike = Record<string, unknown> & {
  namespace?: string;
  iterator?: () => AsyncIterable<[string, unknown]>;
};

type RedisLike = {
  scan: (
    cursor: string,
    ...args: (string | number)[]
  ) => Promise<[string, string[]]>;
  del: (...keys: string[]) => Promise<number>;
};

/**
 * Clears the backend response cache (CustomCacheInterceptor entries, keyed
 * `<resource>:...`) for whole resources — every language, user and query —
 * plus the resources that embed their data (see DEPENDENT_RESOURCES).
 *
 * Keys are matched by prefix (`products:`), so `category` never matches
 * `sub-category:` and unrelated entries (role permissions, settings) are kept.
 *
 * Used by ClearCacheInterceptor (@ClearCache) and by services that change a
 * resource outside its own controller (e.g. order stock changes → 'products').
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /** The given resources plus every resource that depends on them. */
  static expand(resources: string[]): string[] {
    return [
      ...new Set(
        resources.flatMap((r) => [r, ...(DEPENDENT_RESOURCES[r] ?? [])]),
      ),
    ];
  }

  async clearResources(resources: string[]): Promise<void> {
    const expanded = CacheInvalidationService.expand(resources);
    const prefixes = expanded.map((r) => `${r}:`);
    const matches = (key: string) => prefixes.some((p) => key.startsWith(p));

    const cm = this.cacheManager as unknown as Record<string, unknown>;
    const stores = Array.isArray(cm.stores) ? (cm.stores as KeyvLike[]) : [];

    let cleared = 0;
    // Whether at least one strategy could list keys. If it could and nothing
    // matched, there is simply nothing to clear — never wipe the whole cache.
    let canEnumerate = false;

    for (const store of stores) {
      const keys = await this.listKeys(store);
      if (keys === null) {
        // Redis: delete server-side by pattern (SCAN, never the blocking KEYS)
        const redisCleared = await this.clearRedis(store, expanded);
        if (redisCleared !== null) {
          canEnumerate = true;
          cleared += redisCleared;
        }
        continue;
      }
      canEnumerate = true;
      for (const key of keys.filter(matches)) {
        await this.cacheManager.del(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.logger.log(
        `🧹 Cache cleared for: ${expanded.join(', ')} (${cleared} entries)`,
      );
      return;
    }
    if (canEnumerate) return; // nothing cached for these resources

    // Unknown store that can't be enumerated: correctness over hit rate
    if (typeof cm.clear === 'function') {
      await (cm.clear as () => Promise<void>)();
      this.logger.warn(
        `🧹 Full cache cleared (store not enumerable) for: ${expanded.join(', ')}`,
      );
      return;
    }
    this.logger.warn(`⚠️ Could not clear cache for: ${expanded.join(', ')}`);
  }

  /**
   * Keys of an in-process store, without the Keyv namespace prefix
   * (the form cacheManager.del expects). `null` when not enumerable here.
   */
  private async listKeys(store: KeyvLike): Promise<string[] | null> {
    const adapter = store.store as Record<string, unknown> | undefined;

    // CacheableMemory (bounded LRU store used by the app)
    if (adapter && typeof adapter.getStore === 'function') {
      const mem = (
        adapter.getStore as (ns?: string) => { keys: Iterable<string> }
      )(store.namespace);
      return [...mem.keys];
    }

    // Keyv async iterator (plain Map store, default cache-manager setup)
    if (typeof store.iterator === 'function') {
      const keys: string[] = [];
      for await (const [key] of store.iterator.call(store)) {
        if (typeof key === 'string') keys.push(key);
      }
      return keys;
    }

    return null;
  }

  /** Deleted count, or `null` if the store has no Redis client. */
  private async clearRedis(
    store: KeyvLike,
    resources: string[],
  ): Promise<number | null> {
    const adapter = store.store as Record<string, unknown> | undefined;
    const client = (adapter?.client ?? store.client) as RedisLike | undefined;
    if (!client || typeof client.scan !== 'function') return null;

    const ns = store.namespace ? `${store.namespace}:` : '';
    let deleted = 0;
    for (const resource of resources) {
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(
          cursor,
          'MATCH',
          `${ns}${resource}:*`,
          'COUNT',
          500,
        );
        cursor = next;
        if (keys.length > 0) deleted += await client.del(...keys);
      } while (cursor !== '0');
    }
    return deleted;
  }
}
