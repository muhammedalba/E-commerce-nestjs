import { createCache } from 'cache-manager';
import { CacheInvalidationService } from './cache-invalidation.service';

/**
 * Uses a real cache-manager instance built exactly like
 * `CacheModule.register({ isGlobal: true })` does (no stores option), with keys
 * in the shape produced by CustomCacheInterceptor.
 */
describe('CacheInvalidationService (real cache-manager)', () => {
  const key = (path: string, lang: string) =>
    `products:${path}:lang=${lang}:user=guest`;

  it('clears every language/query entry of a resource, keeps others', async () => {
    const cache = createCache({});
    const service = new CacheInvalidationService(cache as never);

    const productKeys = [
      key('/api/v1/products/drill-x?all_langs=true', 'ar'),
      key('/api/v1/products/drill-x?all_langs=true', 'en'),
      key('/api/v1/products/drill-x', 'ar'),
      key('/api/v1/products?limit=10', 'ar'),
    ];
    for (const k of productKeys) await cache.set(k, { stale: true }, 60_000);
    await cache.set('order:/api/v1/order:lang=ar:user=1', { keep: 1 }, 60_000);

    await service.clearResources(['products']);

    for (const k of productKeys) {
      expect(await cache.get(k)).toBeUndefined();
    }
    expect(await cache.get('order:/api/v1/order:lang=ar:user=1')).toEqual({
      keep: 1,
    });
  });
});

describe('CacheInvalidationService – no full wipe', () => {
  it('keeps unrelated entries when nothing matches the resource', async () => {
    const cache = createCache({});
    const service = new CacheInvalidationService(cache as never);
    await cache.set('role_permissions:42', ['a'], 60_000);

    await service.clearResources(['products']); // nothing cached for products

    expect(await cache.get('role_permissions:42')).toEqual(['a']);
  });
});
