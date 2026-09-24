import { Types } from 'mongoose';
import { ReviewCleanupListener } from './review-cleanup.listener';
import { REVIEW_EVENTS } from '../shared/events/review.events';
import { UserDeletedEvent } from 'src/users/shared/events/user.events';
import { ProductDeletedEvent } from 'src/products/shared/events/product.events';

describe('ReviewCleanupListener', () => {
  const userId = new Types.ObjectId().toString();
  const productA = new Types.ObjectId();
  const productB = new Types.ObjectId();

  let reviewModel: Record<string, jest.Mock>;
  let emit: jest.Mock;
  let clearResources: jest.Mock;
  let listener: ReviewCleanupListener;

  beforeEach(() => {
    reviewModel = {
      distinct: jest.fn(() => Promise.resolve([productA, productB])),
      deleteMany: jest.fn(() => Promise.resolve({ deletedCount: 3 })),
    };
    emit = jest.fn();
    clearResources = jest.fn(() => Promise.resolve());
    listener = new ReviewCleanupListener(
      reviewModel as never,
      { emit } as never,
      { clearResources } as never,
    );
  });

  it("deletes the user's reviews and recomputes each affected product", async () => {
    await listener.handleUserDeleted(new UserDeletedEvent(userId));

    const [filter] = reviewModel.deleteMany.mock.calls[0] as [
      { user: Types.ObjectId },
    ];
    expect(String(filter.user)).toBe(userId);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith(
      REVIEW_EVENTS.CHANGED,
      expect.objectContaining({ productId: productA }),
    );
    expect(clearResources).toHaveBeenCalledWith(['reviews']);
  });

  it('does nothing when the user had no reviews', async () => {
    reviewModel.distinct.mockResolvedValueOnce([]);
    reviewModel.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });

    await listener.handleUserDeleted(new UserDeletedEvent(userId));

    expect(emit).not.toHaveBeenCalled();
    expect(clearResources).not.toHaveBeenCalled();
  });

  it('never throws (runs after the user is already deleted)', async () => {
    reviewModel.distinct.mockRejectedValueOnce(new Error('db down'));
    await expect(
      listener.handleUserDeleted(new UserDeletedEvent(userId)),
    ).resolves.toBeUndefined();
  });

  describe('product hard-deleted', () => {
    const productId = productA.toString();

    it("deletes the product's reviews without recomputing any rating", async () => {
      await listener.handleProductDeleted(new ProductDeletedEvent(productId));

      const [filter] = reviewModel.deleteMany.mock.calls[0] as [
        { product: Types.ObjectId },
      ];
      expect(String(filter.product)).toBe(productId);
      expect(emit).not.toHaveBeenCalled();
      expect(clearResources).toHaveBeenCalledWith(['reviews']);
    });

    it('never throws', async () => {
      reviewModel.deleteMany.mockRejectedValueOnce(new Error('db down'));
      await expect(
        listener.handleProductDeleted(new ProductDeletedEvent(productId)),
      ).resolves.toBeUndefined();
    });
  });
});
