import { createCache } from 'cache-manager';
import { createKeyv } from 'cacheable';
import { CacheInvalidationService } from './cache-invalidation.service';

const key = (resource: string, path: string, lang = 'ar') =>
  `${resource}:${path}:lang=${lang}:user=guest`;

// Same store the app registers (expiry sweep disabled so Jest can exit)
const appCache = () =>
  createCache({ stores: [createKeyv({ lruSize: 100, checkInterval: 0 })] });

describe('CacheInvalidationService (bounded CacheableMemory store)', () => {
  it('clears every language/query entry of a resource, keeps others', async () => {
    const cache = appCache();
    const service = new CacheInvalidationService(cache as never);
    const productKeys = [
      key('products', '/api/v1/products/drill?all_langs=true', 'ar'),
      key('products', '/api/v1/products/drill?all_langs=true', 'en'),
      key('products', '/api/v1/products?limit=10'),
    ];
    for (const k of productKeys) await cache.set(k, 1, 60_000);
    await cache.set('role_permissions:42', ['a'], 60_000);
    await cache.set(key('order', '/api/v1/order'), 1, 60_000);

    await service.clearResources(['products']);

    for (const k of productKeys) expect(await cache.get(k)).toBeUndefined();
    expect(await cache.get('role_permissions:42')).toEqual(['a']);
    expect(await cache.get(key('order', '/api/v1/order'))).toBe(1);
  });

  it('matches by prefix: clearing categories keeps sub-category entries', async () => {
    const cache = appCache();
    const service = new CacheInvalidationService(cache as never);
    await cache.set(key('sub-category', '/api/v1/sub-category'), 1, 60_000);
    await cache.set(key('categories', '/api/v1/categories'), 1, 60_000);

    await service.clearResources(['categories']);

    expect(
      await cache.get(key('categories', '/api/v1/categories')),
    ).toBeUndefined();
    expect(await cache.get(key('sub-category', '/api/v1/sub-category'))).toBe(
      1,
    );
  });

  it('also clears resources that embed the changed data (brand → products)', async () => {
    const cache = appCache();
    const service = new CacheInvalidationService(cache as never);
    await cache.set(key('products', '/api/v1/products'), 1, 60_000);
    await cache.set(key('brands', '/api/v1/brands'), 1, 60_000);

    await service.clearResources(['brands']);

    expect(await cache.get(key('brands', '/api/v1/brands'))).toBeUndefined();
    expect(
      await cache.get(key('products', '/api/v1/products')),
    ).toBeUndefined();
  });

  it('never wipes unrelated entries when nothing matches', async () => {
    const cache = appCache();
    const service = new CacheInvalidationService(cache as never);
    await cache.set('role_permissions:42', ['a'], 60_000);
    await service.clearResources(['products']);
    expect(await cache.get('role_permissions:42')).toEqual(['a']);
  });

  it('expand() lists dependents once', () => {
    expect(CacheInvalidationService.expand(['brands', 'categories'])).toEqual([
      'brands',
      'products',
      'categories',
    ]);
  });
});

describe('CacheInvalidationService (default Map store, compatibility)', () => {
  it('still clears via the Keyv iterator', async () => {
    const cache = createCache({});
    const service = new CacheInvalidationService(cache as never);
    await cache.set(key('products', '/api/v1/products'), 1, 60_000);
    await cache.set('role_permissions:1', 1, 60_000);

    await service.clearResources(['products']);

    expect(
      await cache.get(key('products', '/api/v1/products')),
    ).toBeUndefined();
    expect(await cache.get('role_permissions:1')).toBe(1);
  });
});

describe('CacheInvalidationService (Redis store)', () => {
  it('uses SCAN with a prefix pattern, never KEYS', async () => {
    const scan = jest
      .fn()
      .mockResolvedValueOnce(['7', ['app:products:a']])
      .mockResolvedValueOnce(['0', ['app:products:b']]);
    const del = jest.fn().mockResolvedValue(1);
    const keys = jest.fn();
    const service = new CacheInvalidationService({
      stores: [{ namespace: 'app', store: { client: { scan, del, keys } } }],
    } as never);

    await service.clearResources(['products']);

    expect(scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'app:products:*',
      'COUNT',
      500,
    );
    expect(scan).toHaveBeenNthCalledWith(
      2,
      '7',
      'MATCH',
      'app:products:*',
      'COUNT',
      500,
    );
    expect(del).toHaveBeenCalledTimes(2);
    expect(keys).not.toHaveBeenCalled();
  });
});
