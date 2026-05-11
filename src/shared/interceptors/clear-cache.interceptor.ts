import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CLEAR_CACHE_RESOURCES } from '../decorators/clear-cache.decorator';

@Injectable()
export class ClearCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ClearCacheInterceptor.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const resources = this.reflector.get<string[]>(
      CLEAR_CACHE_RESOURCES,
      context.getHandler(),
    );

    if (!resources || resources.length === 0) {
      return next.handle();
    }

    return next.handle().pipe(
      concatMap(async (data) => {
        try {
          await this.clearCacheForResources(resources);
        } catch (error) {
          this.logger.error('Failed to clear cache', error);
        }
        return data;
      }),
    );
  }

  private async clearCacheForResources(resources: string[]): Promise<void> {
    const cm = this.cacheManager as any;

    // Strategy 1: Try to access the underlying store for Redis or compatible stores
    const store = cm.store || cm.stores?.[0];

    if (store) {
      // Check if it's a Redis-backed store
      const client = store.client || store._client;
      if (
        client &&
        typeof client.keys === 'function' &&
        typeof client.del === 'function'
      ) {
        for (const resource of resources) {
          const keys = await client.keys(`${resource}:*`);
          if (keys.length > 0) {
            await client.del(...keys);
          }
        }
        this.logger.log(`🧹 Redis cache cleared for: ${resources.join(', ')}`);
        return;
      }

      // Check if the store itself has keys() (e.g. lru-cache based memory store)
      if (typeof store.keys === 'function') {
        try {
          const allKeys = await store.keys();
          if (Array.isArray(allKeys)) {
            for (const resource of resources) {
              const matched = allKeys.filter(
                (k: string) =>
                  typeof k === 'string' && k.startsWith(`${resource}:`),
              );
              for (const key of matched) {
                await this.cacheManager.del(key);
              }
            }
            this.logger.log(
              `🧹 Memory cache cleared for: ${resources.join(', ')}`,
            );
            return;
          }
        } catch {
          // keys() not supported or errored, fall through
        }
      }
    }

    // Strategy 2: Try reset() to clear all cache (cache-manager v5/v6 compatibility)
    if (typeof cm.reset === 'function') {
      await cm.reset();
      this.logger.log(`🧹 Cache reset for: ${resources.join(', ')}`);
      return;
    }

    // Strategy 3: For cache-manager v7 with Keyv adapter, use clear()
    if (typeof cm.clear === 'function') {
      await cm.clear();
      this.logger.log(`🧹 Cache cleared (full) for: ${resources.join(', ')}`);
      return;
    }

    // Strategy 4: Access internal Keyv stores and clear them
    if (cm._stores) {
      for (const s of cm._stores) {
        if (typeof s.clear === 'function') {
          await s.clear();
        }
      }
      this.logger.log(`🧹 Keyv stores cleared for: ${resources.join(', ')}`);
      return;
    }

    this.logger.warn(`⚠️ Could not clear cache for: ${resources.join(', ')}`);
  }
}
