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

@Injectable()
export class ClearCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ClearCacheInterceptor.name);

  constructor(
    private readonly cacheInvalidation: CacheInvalidationService,
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
        return data;
      }),
    );
  }
}
