import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { CustomCacheInterceptor } from './custom-cache.interceptor';

describe('CustomCacheInterceptor key normalization', () => {
  const interceptor = Object.create(
    CustomCacheInterceptor.prototype,
  ) as CustomCacheInterceptor;
  const trackBy = (ctx: ExecutionContext) =>
    (
      interceptor as unknown as {
        trackBy: (c: ExecutionContext) => string | undefined;
      }
    ).trackBy(ctx);

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
      }),
    } as unknown as ExecutionContext;
  };
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
  });
  afterEach(() => jest.restoreAllMocks());

  it('sorts query params so equivalent URLs share one entry', () => {
    setLang('en');
    const a = trackBy(ctx('/api/v1/products?limit=10&page=2'));
    const b = trackBy(ctx('/api/v1/products?page=2&limit=10'));
    expect(a).toBe(
      'products:/api/v1/products?limit=10&page=2:lang=en:user=guest',
    );
    expect(b).toBe(a);
  });

  it('uses the language nestjs-i18n resolved, restricted to ar|en', () => {
    setLang('en');
    expect(trackBy(ctx('/api/v1/brands'))).toContain(':lang=en:');
    setLang('fr-CA'); // unsupported → default, not a new key
    expect(trackBy(ctx('/api/v1/brands'))).toContain(':lang=ar:');
    setLang(undefined);
    expect(trackBy(ctx('/api/v1/brands'))).toContain(':lang=ar:');
  });

  it('does not cache free-text search (unbounded key space)', () => {
    setLang('ar');
    expect(trackBy(ctx('/api/v1/products?keywords=drill'))).toBeUndefined();
    // an empty keywords param is not a search
    expect(trackBy(ctx('/api/v1/products?keywords='))).toBeDefined();
  });

  it('does not cache very long URLs', () => {
    setLang('ar');
    const longIds = 'a'.repeat(600);
    expect(trackBy(ctx(`/api/v1/products?ids=${longIds}`))).toBeUndefined();
  });

  it('scopes by user and respects the base (non-GET) check', () => {
    setLang('ar');
    expect(trackBy(ctx('/api/v1/order/my-orders', 'u1'))).toMatch(/:user=u1$/);
    baseTrackBy(undefined);
    expect(trackBy(ctx('/api/v1/products'))).toBeUndefined();
  });
});
