import {
  CACHE_MANAGER,
  CACHE_TTL_METADATA,
  CacheInterceptor,
} from '@nestjs/cache-manager';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Cache } from 'cache-manager';
import { Request } from 'express';
import { I18nContext } from 'nestjs-i18n';
import { from, lastValueFrom, Observable, of } from 'rxjs';
import { CacheInvalidationService } from '../services/cache-invalidation.service';
import { CacheMetricsService } from '../services/cache-metrics.service';

/** Languages the API localizes into; anything else maps to the default. */
const SUPPORTED_LANGS = ['ar', 'en'];

/**
 * Free-text query params: every distinct value would create a new cache entry
 * (low hit rate, attacker-controlled key space), so such requests bypass the cache.
 */
const UNCACHEABLE_QUERY_PARAMS = ['keywords'];

/** Unusually long URLs are not worth caching and would bloat keys. */
const MAX_CACHEABLE_URL_LENGTH = 512;

/**
 * Response cache interceptor.
 *
 * Key: `<resource>:v<version>:<path>?<sorted query>:lang=<ar|en>:user=<id|guest>`
 * - `version` comes from CacheInvalidationService: invalidating a resource
 *   bumps it, so every old entry becomes unreachable at once (O(1)).
 * - Query params are sorted: `?a=1&b=2` and `?b=2&a=1` share one entry.
 * - `lang` is the language nestjs-i18n actually resolved for this request
 *   (?lang → Accept-Language → x-lang, then fallback) — the same source the
 *   response is localized with — restricted to supported languages.
 *
 * Single-flight: concurrent misses for the same key share one handler run
 * (one DB query) instead of all hitting MongoDB when a hot entry expires.
 */
@Injectable()
export class CustomCacheInterceptor extends CacheInterceptor {
  /** In-flight handler runs per cache key (per instance). */
  private static readonly inflight = new Map<string, Promise<unknown>>();

  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
    reflector: Reflector,
    private readonly invalidation: CacheInvalidationService,
    private readonly metrics: CacheMetricsService,
  ) {
    super(cacheManager, reflector);
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const key = this.trackBy(context);
    if (!key) return next.handle();

    try {
      const cached: unknown = await (this.cacheManager as Cache).get(key);
      this.setHeadersWhenHttp(context, cached);
      if (cached !== undefined && cached !== null) {
        this.metrics.hit();
        return of(cached);
      }
    } catch {
      return next.handle(); // cache unavailable: serve uncached
    }
    this.metrics.miss();

    const pending = CustomCacheInterceptor.inflight.get(key);
    if (pending) {
      this.metrics.coalesce();
      return from(pending);
    }

    const ttl = this.ttlFor(context);
    const run = lastValueFrom(next.handle())
      .then(async (response: unknown) => {
        if (!(response instanceof StreamableFile)) {
          await (this.cacheManager as Cache)
            .set(key, response, ttl ?? undefined)
            .catch(() => undefined); // caching is best-effort
        }
        return response;
      })
      .finally(() => CustomCacheInterceptor.inflight.delete(key));
    CustomCacheInterceptor.inflight.set(key, run);
    return from(run);
  }

  protected trackBy(context: ExecutionContext): string | undefined {
    // Keeps the base checks (GET only, @CacheKey overrides, HTTP context)
    if (super.trackBy(context) === undefined) return undefined;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { user_id: string } }>();

    const rawQuery = request.originalUrl.split('?')[1] ?? '';
    const params = new URLSearchParams(rawQuery);
    if (UNCACHEABLE_QUERY_PARAMS.some((p) => params.get(p)?.trim())) {
      return undefined;
    }
    params.sort();
    const query = params.toString();
    const url = query ? `${request.path}?${query}` : request.path;
    if (url.length > MAX_CACHEABLE_URL_LENGTH) return undefined;

    // Path structure: /api/v1/<resource>/...
    const resource = request.path.split('/')[3] || 'global';
    const version = this.invalidation.versionOf(resource);
    const userId = request.user?.user_id || 'guest';

    return `${resource}:v${version}:${url}:lang=${resolveLang(context)}:user=${userId}`;
  }

  private ttlFor(context: ExecutionContext): number | null {
    const value: unknown =
      this.reflector.get(CACHE_TTL_METADATA, context.getHandler()) ??
      this.reflector.get(CACHE_TTL_METADATA, context.getClass());
    return typeof value === 'number' ? value : null;
  }
}

function resolveLang(context: ExecutionContext): string {
  const fallback = process.env.DEFAULT_LANGUAGE ?? 'ar';
  const lang = I18nContext.current(context)?.lang ?? fallback;
  return SUPPORTED_LANGS.includes(lang) ? lang : fallback;
}
