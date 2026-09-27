import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { I18nContext } from 'nestjs-i18n';

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
 * Response cache interceptor with a normalized key:
 *   `<resource>:<path>?<sorted query>:lang=<ar|en>:user=<id|guest>`
 *
 * - `resource` comes first so invalidation can match by prefix (`products:`).
 * - Query params are sorted: `?a=1&b=2` and `?b=2&a=1` share one entry.
 * - `lang` is the language nestjs-i18n actually resolved for this request
 *   (?lang → Accept-Language → x-lang, then fallback) — the same source the
 *   response is localized with — restricted to supported languages. Raw
 *   headers are never used, so a response can't be stored under the wrong
 *   language and arbitrary header values can't create new keys.
 */
@Injectable()
export class CustomCacheInterceptor extends CacheInterceptor {
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
    const userId = request.user?.user_id || 'guest';

    return `${resource}:${url}:lang=${resolveLang(context)}:user=${userId}`;
  }
}

function resolveLang(context: ExecutionContext): string {
  const fallback = process.env.DEFAULT_LANGUAGE ?? 'ar';
  const lang = I18nContext.current(context)?.lang ?? fallback;
  return SUPPORTED_LANGS.includes(lang) ? lang : fallback;
}
