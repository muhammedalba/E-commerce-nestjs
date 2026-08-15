import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

/**
 * Custom cache interceptor that includes the request language in the cache key.
 * This prevents cross-language cache corruption when using i18n.
 */
@Injectable()
export class CustomCacheInterceptor extends CacheInterceptor {
  protected trackBy(context: ExecutionContext): string | undefined {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { user_id: string } }>();
    const httpMethod = request.method;

    // Only cache GET requests
    if (httpMethod !== 'GET') return undefined;

    // Extract resource name (e.g., 'products' from '/api/v1/products')
    // Path structure: /api/v1/resource/...
    const pathParts = request.path.split('/');
    const resource = pathParts[3] || 'global';

    const langHeader =
      request.headers['x-lang'] || request.headers['accept-language'];
    const lang =
      (Array.isArray(langHeader) ? langHeader[0] : langHeader) || 'ar';

    const userId = request.user?.user_id || 'guest';

    const baseKey = super.trackBy(context) as string | undefined;
    return baseKey
      ? `${resource}:${baseKey}:lang=${lang}:user=${userId}`
      : undefined;
  }
}
