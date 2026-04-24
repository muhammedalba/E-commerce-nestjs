import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Redis } from 'ioredis';
import { Reflector } from '@nestjs/core';
import { CLEAR_CACHE_RESOURCES } from '../decorators/clear-cache.decorator';

@Injectable()
export class ClearCacheInterceptor implements NestInterceptor {
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
      tap(async () => {
        // @ts-ignore
        const store = this.cacheManager.store;
        
        if (store.name === 'redis' || store.client instanceof Redis) {
          const client: Redis = (store as any).client;
          for (const resource of resources) {
            const keys = await client.keys(`${resource}:*`);
            if (keys.length > 0) {
              await client.del(...keys);
              console.log(`🧹 Cache cleared for resources: ${resources.join(', ')}`);
            }
          }
        }
      }),
    );
  }
}
