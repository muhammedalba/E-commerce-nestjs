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

  intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    const resources = this.reflector.get<string[]>(
      CLEAR_CACHE_RESOURCES,
      context.getHandler(),
    );

    if (!resources || resources.length === 0) {
      return next.handle();
    }

    return next.handle().pipe(
      concatMap(async (data: T) => {
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
    const cm = this.cacheManager as unknown as Record<string, unknown>;
    let clearedAny = false;

    // Strategy 1: Iterate cache-manager v6 Keyv stores (Memory or Redis)
    const rawStores = cm.stores || (cm.store ? [cm.store] : []);
    const stores = Array.isArray(rawStores)
      ? (rawStores as Record<string, unknown>[])
      : [];
    console.log('stores', stores);

    console.log('------------------------------------------------');
    for (const s of stores) {
      // 1a) Try Keyv async iterator (standard for cache-manager v6)
      console.log('s', s);
      console.log('------------------------------------------------');

      console.log('s.iterator', s.iterator);

      if (typeof s.iterator === 'function') {
        try {
          const iteratorFn = s.iterator as () => AsyncIterable<
            [string, unknown]
          >;
          for await (const [key] of iteratorFn.call(s)) {
            if (
              typeof key === 'string' &&
              resources.some((r) => key.includes(`${r}:`))
            ) {
              await this.cacheManager.del(key);
              clearedAny = true;
            }
          }
        } catch (e) {
          this.logger.error('Error iterating cache keys:', e);
        }
      }

      // 1b) Try internal Map store (_store or opts.store)
      const opts = s.opts as Record<string, unknown> | undefined;
      const map = (opts?.store || s._store) as Map<string, unknown> | undefined;
      if (map instanceof Map) {
        for (const key of Array.from(map.keys())) {
          if (
            typeof key === 'string' &&
            resources.some((r) => key.includes(`${r}:`))
          ) {
            map.delete(key);
            clearedAny = true;
          }
        }
      }

      // 1c) Try Redis client if attached to store
      const optsStore = opts?.store as Record<string, unknown> | undefined;
      const client = (s.client ||
        s._client ||
        optsStore?.client ||
        optsStore?._client) as
        | {
            keys?: (p: string) => Promise<string[]>;
            del?: (...k: string[]) => Promise<number>;
          }
        | undefined;
      if (
        client &&
        typeof client.keys === 'function' &&
        typeof client.del === 'function'
      ) {
        for (const resource of resources) {
          const keys = await client.keys(`*${resource}:*`);
          if (keys && keys.length > 0) {
            await client.del(...keys);
            clearedAny = true;
          }
        }
      }
    }

    if (clearedAny) {
      this.logger.log(`🧹 Cache cleared for: ${resources.join(', ')}`);
      return;
    }

    // Strategy 2: Fallback to clear() or reset() if targeted key clearing didn't find matching keys
    if (typeof cm.clear === 'function') {
      await (cm.clear as () => Promise<void>)();
      this.logger.log(`🧹 Full cache cleared for: ${resources.join(', ')}`);
      return;
    }

    if (typeof cm.reset === 'function') {
      await (cm.reset as () => Promise<void>)();
      this.logger.log(`🧹 Full cache reset for: ${resources.join(', ')}`);
      return;
    }

    this.logger.warn(`⚠️ Could not clear cache for: ${resources.join(', ')}`);
  }
}
