import { Types } from 'mongoose';
import { ReviewRatingSyncService } from './review-rating-sync.service';
import { ReviewChangedEvent } from '../shared/events/review.events';

describe('ReviewRatingSyncService.handleReviewChanged', () => {
  const productId = new Types.ObjectId();
  let calls: string[];
  let findOneAndUpdate: jest.Mock;
  let revalidate: jest.Mock;
  let service: ReviewRatingSyncService;

  const build = (aggregateImpl: () => Promise<unknown>) => {
    calls = [];
    findOneAndUpdate = jest.fn(() => {
      calls.push('updateRatings');
      return Promise.resolve({ slug: 'drill-x' });
    });
    revalidate = jest.fn(() => {
      calls.push('revalidate');
      return Promise.resolve();
    });
    service = new ReviewRatingSyncService(
      { aggregate: jest.fn(aggregateImpl) } as never,
      { findOneAndUpdate } as never,
      {
        clearResources: jest.fn(() => {
          calls.push('clearBackendCache');
          return Promise.resolve();
        }),
      } as never,
      { revalidate } as never,
    );
  };

  it('writes the rounded average of approved reviews, then invalidates caches', async () => {
    build(() => Promise.resolve([{ average: 4.26, count: 3 }]));
    await service.handleReviewChanged(new ReviewChangedEvent(productId));

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: productId },
      { $set: { ratingsAverage: 4.3, ratingsQuantity: 3 } },
      expect.anything(),
    );
    expect(calls).toEqual(['updateRatings', 'clearBackendCache', 'revalidate']);
    expect(revalidate).toHaveBeenCalledWith(['products', 'product-drill-x']);
  });

  it('resets to 0 when no approved review is left', async () => {
    build(() => Promise.resolve([]));
    await service.handleReviewChanged(new ReviewChangedEvent(productId));

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: productId },
      { $set: { ratingsAverage: 0, ratingsQuantity: 0 } },
      expect.anything(),
    );
  });

  it('never throws (runs asynchronously after the write)', async () => {
    build(() => Promise.reject(new Error('db down')));
    await expect(
      service.handleReviewChanged(new ReviewChangedEvent(productId)),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });
});
