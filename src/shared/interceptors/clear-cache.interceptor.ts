import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CLEAR_CACHE_RESOURCES } from '../decorators/clear-cache.decorator';
import { CacheInvalidationService } from '../services/cache-invalidation.service';
import { RevalidationService } from '../services/revalidation.service';

/**
 * Storefront (Next.js ISR) tags to expire when a resource changes.
 * Product pages and lists carry the 'products' tag and embed category/brand
 * names, so those changes expire it too.
 *
 * Deliberately absent:
 * - 'products': ProductMutationService / AggregationSyncService revalidate it
 *   themselves, with per-product tags and after aggregates are final.
 * - 'settings': SettingsService revalidates it itself.
 */
const STOREFRONT_TAGS: Record<string, string[]> = {
  categories: ['categories', 'products'],
  'sub-category': ['categories', 'products'],
  brands: ['brands', 'products'],
  carousel: ['carousel'],
  'promo-banner': ['promo-banner'],
};

@Injectable()
export class ClearCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ClearCacheInterceptor.name);

  constructor(
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly revalidationService: RevalidationService,
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
          await this.cacheInvalidation.clearResources(resources);
        } catch (error) {
          this.logger.error('Failed to clear cache', error);
        }
        // After the backend cache is clear, so Next refetches fresh data.
        // Best-effort (never throws).
        const tags = resources.flatMap((r) => STOREFRONT_TAGS[r] ?? []);
        if (tags.length > 0) {
          await this.revalidationService.revalidate(tags);
        }
        return data;
      }),
    );
  }
}
