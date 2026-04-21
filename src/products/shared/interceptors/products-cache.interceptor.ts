import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Custom cache interceptor that includes the request language in the cache key.
 * This prevents cross-language cache corruption when using i18n.
 *
 * Default CacheInterceptor only uses the URL as key, which means
 * two requests with different Accept-Language headers would get
 * the same cached response — breaking localization.
 */
@Injectable()
export class ProductsCacheInterceptor extends CacheInterceptor {
  protected trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    const httpMethod = request.method;

    // Only cache GET requests
    if (httpMethod !== 'GET') return undefined;

    const lang =
      request.headers['x-lang'] ||
      request.headers['accept-language'] ||
      'ar';

    const baseKey = super.trackBy(context);
    return baseKey ? `${baseKey}:lang=${lang}` : undefined;
  }
}
