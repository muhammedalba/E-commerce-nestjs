import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Custom cache interceptor that includes the request language in the cache key.
 * This prevents cross-language cache corruption when using i18n.
 */
@Injectable()
export class CustomCacheInterceptor extends CacheInterceptor {
  protected trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    const httpMethod = request.method;

    // Only cache GET requests
    if (httpMethod !== 'GET') return undefined;

    // Extract resource name (e.g., 'products' from '/api/v1/products')
    // Path structure: /api/v1/resource/...
    const pathParts = request.path.split('/');
    const resource = pathParts[3] || 'global';

    const lang =
      request.headers['x-lang'] || request.headers['accept-language'] || 'ar';

    const userId = request.user?.user_id || 'guest';

    const baseKey = super.trackBy(context);
    return baseKey ? `${resource}:${baseKey}:lang=${lang}:user=${userId}` : undefined;
  }
}
