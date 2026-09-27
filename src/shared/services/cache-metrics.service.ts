import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * In-process counters for the response cache (per server instance, reset on
 * restart). Exposed to admins via GET /settings/cache-stats.
 */
@Injectable()
export class CacheMetricsService {
  private readonly startedAt = new Date();
  private hits = 0;
  private misses = 0;
  /** Misses that joined an in-flight identical request instead of querying. */
  private coalesced = 0;
  private invalidations = 0;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  hit() {
    this.hits++;
  }
  miss() {
    this.misses++;
  }
  coalesce() {
    this.coalesced++;
  }
  invalidated(count = 1) {
    this.invalidations += count;
  }

  /**
   * Entries currently held in memory (includes superseded versions not yet
   * reclaimed by LRU / expiry). `null` if the store can't report it.
   */
  entries(): number | null {
    const stores = (this.cacheManager as unknown as { stores?: unknown[] })
      .stores;
    const keyv = stores?.[0] as
      | {
          namespace?: string;
          store?: { getStore?: (ns?: string) => { size?: number } };
        }
      | undefined;
    const size = keyv?.store?.getStore?.(keyv.namespace)?.size;
    return typeof size === 'number' ? size : null;
  }

  snapshot(extra: Record<string, unknown> = {}) {
    const lookups = this.hits + this.misses;
    return {
      entries: this.entries(),
      since: this.startedAt.toISOString(),
      hits: this.hits,
      misses: this.misses,
      coalesced: this.coalesced,
      hitRate: lookups ? Number((this.hits / lookups).toFixed(3)) : null,
      invalidations: this.invalidations,
      ...extra,
    };
  }
}
