import { CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createCache } from 'cache-manager';
import { createKeyv } from 'cacheable';
import { I18nContext } from 'nestjs-i18n';
import { lastValueFrom, Observable, of } from 'rxjs';
import { CacheInvalidationService } from '../services/cache-invalidation.service';
import { CacheMetricsService } from '../services/cache-metrics.service';
import { CustomCacheInterceptor } from './custom-cache.interceptor';

const config = { get: () => 'test' } as unknown as ConfigService;

const build = () => {
  const cache = createCache({
    stores: [createKeyv({ lruSize: 100, checkInterval: 0 })],
  });
  const metrics = new CacheMetricsService(cache as never);
  const invalidation = new CacheInvalidationService(metrics, config);
  const reflector = { get: () => 60_000 } as unknown as Reflector;
  const interceptor = new CustomCacheInterceptor(
    cache as never,
    reflector,
    invalidation,
    metrics,
  );
  return { interceptor, invalidation, metrics };
};

const ctx = (originalUrl: string, user?: string) => {
  const path = originalUrl.split('?')[0];
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        originalUrl,
        path,
        user: user ? { user_id: user } : undefined,
      }),
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

const trackBy = (i: CustomCacheInterceptor, c: ExecutionContext) =>
  (
    i as unknown as { trackBy: (c: ExecutionContext) => string | undefined }
  ).trackBy(c);

const setLang = (lang: string | undefined) =>
  jest
    .spyOn(I18nContext, 'current')
    .mockReturnValue(lang ? ({ lang } as I18nContext) : undefined);
const baseTrackBy = (value: string | undefined) =>
  jest
    .spyOn(CacheInterceptor.prototype as never, 'trackBy')
    .mockReturnValue(value as never);

beforeEach(() => {
  process.env.DEFAULT_LANGUAGE = 'ar';
  baseTrackBy('x'); // base checks (GET, HTTP context) pass
  setLang('ar');
});
afterEach(() => jest.restoreAllMocks());

describe('CustomCacheInterceptor key', () => {
  it('includes the resource version and sorts query params', () => {
    const { interceptor } = build();
    setLang('en');
    const a = trackBy(interceptor, ctx('/api/v1/products?limit=10&page=2'));
    const b = trackBy(interceptor, ctx('/api/v1/products?page=2&limit=10'));
    expect(a).toBe(
      'products:v0.0:/api/v1/products?limit=10&page=2:lang=en:user=guest',
    );
    expect(b).toBe(a);
  });

  it('invalidation changes the key (old entries become unreachable)', async () => {
    const { interceptor, invalidation } = build();
    const before = trackBy(interceptor, ctx('/api/v1/products'));
    await invalidation.clearResources(['brands']); // dependent: products
    expect(trackBy(interceptor, ctx('/api/v1/products'))).not.toBe(before);
    expect(trackBy(interceptor, ctx('/api/v1/products'))).toContain(':v0.1:');
  });

  it('uses the language nestjs-i18n resolved, restricted to ar|en', () => {
    const { interceptor } = build();
    setLang('en');
    expect(trackBy(interceptor, ctx('/api/v1/brands'))).toContain(':lang=en:');
    setLang('fr-CA');
    expect(trackBy(interceptor, ctx('/api/v1/brands'))).toContain(':lang=ar:');
    setLang(undefined);
    expect(trackBy(interceptor, ctx('/api/v1/brands'))).toContain(':lang=ar:');
  });

  it('skips free-text search, very long URLs and non-cacheable requests', () => {
    const { interceptor } = build();
    expect(
      trackBy(interceptor, ctx('/api/v1/products?keywords=drill')),
    ).toBeUndefined();
    expect(
      trackBy(interceptor, ctx('/api/v1/products?keywords=')),
    ).toBeDefined();
    const longIds = 'a'.repeat(600);
    expect(
      trackBy(interceptor, ctx(`/api/v1/products?ids=${longIds}`)),
    ).toBeUndefined();
    expect(trackBy(interceptor, ctx('/api/v1/order/my-orders', 'u1'))).toMatch(
      /:user=u1$/,
    );
    baseTrackBy(undefined);
    expect(trackBy(interceptor, ctx('/api/v1/products'))).toBeUndefined();
  });
});

describe('CustomCacheInterceptor serving', () => {
  const handler = (fn: () => Promise<unknown>): CallHandler => ({
    handle: () =>
      new Observable((sub) => {
        fn().then(
          (v) => {
            sub.next(v);
            sub.complete();
          },
          (e: unknown) => sub.error(e),
        );
      }),
  });
  const serve = async (
    i: CustomCacheInterceptor,
    url: string,
    next: CallHandler,
  ) => lastValueFrom(await i.intercept(ctx(url), next));

  it('serves the second request from cache and counts hit/miss', async () => {
    const { interceptor, metrics } = build();
    const db = jest.fn(() => Promise.resolve({ rows: [1] }));

    await serve(interceptor, '/api/v1/brands', handler(db));
    const second = await serve(interceptor, '/api/v1/brands', handler(db));

    expect(second).toEqual({ rows: [1] });
    expect(db).toHaveBeenCalledTimes(1);
    expect(metrics.snapshot()).toMatchObject({ hits: 1, misses: 1 });
  });

  it('single-flight: concurrent misses share one handler run', async () => {
    const { interceptor, metrics } = build();
    let release!: (v: unknown) => void;
    const db = jest.fn(() => new Promise((r) => (release = r)));

    const pending = Promise.all(
      [1, 2, 3].map(() => serve(interceptor, '/api/v1/brands', handler(db))),
    );
    await new Promise((r) => setImmediate(r));
    release({ rows: ['x'] });
    const results = await pending;

    expect(db).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      { rows: ['x'] },
      { rows: ['x'] },
      { rows: ['x'] },
    ]);
    expect(metrics.snapshot()).toMatchObject({ misses: 3, coalesced: 2 });
  });

  it('does not cache failures, and the next request retries', async () => {
    const { interceptor } = build();
    const db = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ ok: true });

    await expect(
      serve(
        interceptor,
        '/api/v1/brands',
        handler(db as () => Promise<unknown>),
      ),
    ).rejects.toThrow('db down');
    await expect(
      serve(
        interceptor,
        '/api/v1/brands',
        handler(db as () => Promise<unknown>),
      ),
    ).resolves.toEqual({ ok: true });
  });

  it('bypasses the cache for non-cacheable requests', async () => {
    const { interceptor } = build();
    baseTrackBy(undefined);
    const next: CallHandler = { handle: () => of('direct') };
    await expect(serve(interceptor, '/api/v1/brands', next)).resolves.toBe(
      'direct',
    );
  });
});
