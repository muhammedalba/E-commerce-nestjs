import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import {
  REDIS_CLIENT,
  REDIS_SUBSCRIBER,
  redisNamespace,
} from '../redis/redis.module';
import { CacheMetricsService } from './cache-metrics.service';

/**
 * Resources whose cached responses embed data of another resource.
 * - Product responses populate category / sub-category / brand / supplier names.
 * - The profile (auth:me-profile) reflects user data admins can change.
 */
const DEPENDENT_RESOURCES: Record<string, string[]> = {
  categories: ['products'],
  'sub-category': ['products'],
  brands: ['products'],
  supplier: ['products'],
  users: ['auth'],
};

interface InvalidationMessage {
  origin: string;
  resources: string[];
  /** Invalidate every resource (admin "clear cache"). */
  all?: boolean;
}

/**
 * Invalidates the response cache (CustomCacheInterceptor) by **version**:
 * every resource has a version number that is part of its cache keys
 * (`products:v3:...`). Invalidating = bumping the version — O(1), no key
 * scan. Old entries become unreachable and are reclaimed by LRU / TTL / the
 * expiry sweep. Unrelated entries (role permissions, settings) are untouched.
 *
 * Multi-instance: each instance has its own in-memory cache, so bumps are
 * broadcast over Redis pub/sub and applied by every other instance. Without
 * Redis it degrades to local-only invalidation (correct for one instance).
 */
@Injectable()
export class CacheInvalidationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private readonly versions = new Map<string, number>();
  /** Bumped by invalidateAll(): part of every key, so all entries go at once. */
  private generation = 0;
  private readonly instanceId = randomUUID();
  private readonly channel: string;

  constructor(
    private readonly metrics: CacheMetricsService,
    config: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
    @Optional() @Inject(REDIS_SUBSCRIBER) private readonly subscriber?: Redis,
  ) {
    this.channel = `${redisNamespace(config)}:cache-invalidate`;
  }

  /** The given resources plus every resource that depends on them. */
  static expand(resources: string[]): string[] {
    return [
      ...new Set(
        resources.flatMap((r) => [r, ...(DEPENDENT_RESOURCES[r] ?? [])]),
      ),
    ];
  }

  /** Current version token of a resource (part of its cache keys). */
  versionOf(resource: string): string {
    return `${this.generation}.${this.versions.get(resource) ?? 0}`;
  }

  private bumpOne(resource: string) {
    this.versions.set(resource, (this.versions.get(resource) ?? 0) + 1);
  }

  /**
   * Invalidates every cached response of the resources (all languages,
   * users and queries) and of their dependents, on every instance.
   */
  async clearResources(resources: string[]): Promise<void> {
    const expanded = this.bump(resources);
    await this.broadcast({ origin: this.instanceId, resources: expanded });
  }

  /**
   * Invalidates the whole response cache (every resource, language, user and
   * query) on every instance — O(1). Unrelated cache entries (role
   * permissions, settings document, fallback checkout sessions) are kept.
   */
  async invalidateAll(): Promise<void> {
    this.generation++;
    this.metrics.invalidated();
    this.logger.log('🧹 Entire response cache invalidated');
    await this.broadcast({ origin: this.instanceId, resources: [], all: true });
  }

  private async broadcast(message: InvalidationMessage): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.publish(this.channel, JSON.stringify(message));
    } catch (err) {
      // Local invalidation already happened; other instances (if any) catch
      // up when their entries expire.
      this.logger.warn(
        `Invalidation broadcast failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private bump(resources: string[]): string[] {
    const expanded = CacheInvalidationService.expand(resources);
    for (const r of expanded) this.bumpOne(r);
    this.metrics.invalidated(expanded.length);
    this.logger.log(`🧹 Cache invalidated for: ${expanded.join(', ')}`);
    return expanded;
  }

  onModuleInit() {
    const sub = this.subscriber;
    if (!sub) return;
    sub.on('message', (channel: string, raw: string) => {
      if (channel !== this.channel) return;
      try {
        const msg = JSON.parse(raw) as InvalidationMessage;
        // Already applied locally (and dependents already expanded)
        if (msg.origin === this.instanceId) return;
        if (msg.all) this.generation++;
        for (const r of msg.resources) this.bumpOne(r);
      } catch {
        this.logger.warn('Ignoring malformed cache invalidation message');
      }
    });
    // enableOfflineQueue is off: subscribe once connected (ioredis
    // re-subscribes automatically after reconnects).
    const subscribe = () =>
      sub
        .subscribe(this.channel)
        .catch((err: Error) =>
          this.logger.warn(`Subscribe failed: ${err.message}`),
        );
    if (sub.status === 'ready') void subscribe();
    else sub.once('ready', () => void subscribe());
  }

  onModuleDestroy() {
    this.subscriber?.removeAllListeners('message');
  }
}
