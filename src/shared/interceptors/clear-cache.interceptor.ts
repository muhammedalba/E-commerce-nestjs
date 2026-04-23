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

@Injectable()
export class ClearCacheInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // We only clear the cache if the request is a mutation (POST, PUT, PATCH, DELETE)
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (isMutation) {
      return next.handle().pipe(
        tap(async () => {
          // Extract resource name from URL (e.g., 'products' from '/api/v1/products')
          const pathParts = request.path.split('/');
          const resource = pathParts[3];

          if (resource) {
            const store = (this.cacheManager as any).store;

            // Get all keys and filter by resource prefix
            if (typeof store.keys === 'function') {
              const keys: string[] = await store.keys();
              const keysToDelete = keys.filter((key) =>
                key.startsWith(`${resource}:`),
              );

              if (keysToDelete.length > 0) {
                await Promise.all(
                  keysToDelete.map((key) => this.cacheManager.del(key)),
                );
                console.log(
                  `[Cache] Cleared ${keysToDelete.length} keys for resource: ${resource}`,
                );
              }
            } else {
              // Fallback to clear everything if store.keys() is not available
              await this.cacheManager.clear();
            }
          }
        }),
      );
    }

    return next.handle();
  }
}
