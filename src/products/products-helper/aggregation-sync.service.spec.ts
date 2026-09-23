import { Types } from 'mongoose';
import { AggregationSyncService } from './aggregation-sync.service';

describe('AggregationSyncService.syncProduct', () => {
  const productId = new Types.ObjectId();
  let calls: string[];
  let service: AggregationSyncService;
  let revalidate: jest.Mock;

  const build = (aggregateImpl?: () => Promise<unknown>) => {
    calls = [];
    revalidate = jest.fn(() => {
      calls.push('revalidate');
      return Promise.resolve();
    });
    service = new AggregationSyncService(
      {
        findOneAndUpdate: jest.fn(() => {
          calls.push('updateAggregates');
          return Promise.resolve({ slug: 'drill-x' });
        }),
      } as never,
      {
        aggregate: jest.fn(
          aggregateImpl ??
            (() =>
              Promise.resolve([
                { minPrice: 5, maxPrice: 9, totalStock: 12, count: 2 },
              ])),
        ),
      } as never,
      {
        clearResources: jest.fn(() => {
          calls.push('clearBackendCache');
          return Promise.resolve();
        }),
      } as never,
      { revalidate } as never,
    );
  };

  it('invalidates caches only AFTER the aggregates are written', async () => {
    build();
    await service.syncProduct(productId);

    // Reads that raced in before the recompute (stale stock/price, cached
    // under their language key) are wiped by the invalidation that follows.
    expect(calls).toEqual([
      'updateAggregates',
      'clearBackendCache',
      'revalidate',
    ]);
    expect(revalidate).toHaveBeenCalledWith(['products', 'product-drill-x']);
  });

  it('never throws (runs after the DB commit)', async () => {
    build(() => Promise.reject(new Error('db down')));
    await expect(service.syncProduct(productId)).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });
});
