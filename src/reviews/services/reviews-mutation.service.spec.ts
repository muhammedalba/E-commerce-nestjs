import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ReviewsMutationService } from './reviews-mutation.service';
import { ReviewStatus } from '../shared/enums/review-status.enum';
import { REVIEW_EVENTS } from '../shared/events/review.events';

// Avoid loading SettingsService → FileUploadService (ESM-only deps) in unit tests
jest.mock('./review-eligibility.service', () => ({
  ReviewEligibilityService: class {},
}));

// Minimal chainable query mock: `.select(...).lean()` → value
const query = (value: unknown) => {
  const q = {
    select: () => q,
    lean: () => Promise.resolve(value),
  };
  return q;
};

describe('ReviewsMutationService', () => {
  const userId = new Types.ObjectId().toString();
  const productId = new Types.ObjectId().toString();
  const reviewId = new Types.ObjectId().toString();

  let reviewModel: Record<string, jest.Mock>;
  let productModel: Record<string, jest.Mock>;
  let eligibility: Record<string, jest.Mock>;
  let emit: jest.Mock;
  let service: ReviewsMutationService;

  beforeEach(() => {
    reviewModel = {
      exists: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((doc: Record<string, unknown>) =>
        Promise.resolve({
          _id: new Types.ObjectId(reviewId),
          toObject: () => doc,
        }),
      ),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    productModel = {
      exists: jest.fn(() => Promise.resolve({ _id: productId })),
    };
    eligibility = {
      assertCanReview: jest.fn(() => Promise.resolve(false)),
      hasPurchased: jest.fn(() => Promise.resolve(true)),
    };
    emit = jest.fn();
    service = new ReviewsMutationService(
      reviewModel as never,
      productModel as never,
      eligibility as never,
      { emit } as never,
      {
        translate: (key: string) => key,
        localize: <T>(v: T) => v,
      } as never,
    );
  });

  describe('create', () => {
    const dto = { rating: 4, comment: 'Great drill' };

    it('creates a pending review and notifies admins', async () => {
      const res = await service.create(userId, productId, dto);

      expect(reviewModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 4,
          comment: 'Great drill',
          status: ReviewStatus.PENDING,
          isVerifiedPurchase: false,
        }),
      );
      expect(res.message).toBe('success.REVIEW_SUBMITTED');
      expect(emit).toHaveBeenCalledWith(
        REVIEW_EVENTS.SUBMITTED,
        expect.objectContaining({ reviewId, productId, userId }),
      );
    });

    it('rejects a second review with ALREADY_REVIEWED (before the purchase check)', async () => {
      reviewModel.exists.mockResolvedValueOnce({ _id: reviewId });

      await expect(service.create(userId, productId, dto)).rejects.toThrow(
        new ConflictException('exception.review.ALREADY_REVIEWED'),
      );
      expect(eligibility.assertCanReview).not.toHaveBeenCalled();
      expect(reviewModel.create).not.toHaveBeenCalled();
    });

    it('maps a concurrent duplicate-key error to ALREADY_REVIEWED', async () => {
      reviewModel.create.mockRejectedValueOnce({ code: 11000 });

      await expect(service.create(userId, productId, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(emit).not.toHaveBeenCalled();
    });

    it('404s for a missing / inactive product', async () => {
      productModel.exists.mockResolvedValueOnce(null);

      await expect(service.create(userId, productId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateMine', () => {
    it('404s when the product was soft-deleted or deactivated', async () => {
      reviewModel.findOne.mockReturnValueOnce(
        query({
          _id: new Types.ObjectId(reviewId),
          product: new Types.ObjectId(productId),
          status: ReviewStatus.APPROVED,
        }),
      );
      productModel.exists.mockResolvedValueOnce(null);

      await expect(
        service.updateMine(userId, reviewId, { comment: 'edited' }),
      ).rejects.toThrow(
        new NotFoundException('exception.review.PRODUCT_NOT_FOUND'),
      );
      expect(reviewModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });

    it("404s when the review is not the user's", async () => {
      reviewModel.findOne.mockReturnValueOnce(query(null));

      await expect(
        service.updateMine(userId, reviewId, { comment: 'edited' }),
      ).rejects.toThrow(NotFoundException);
      expect(reviewModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('puts an approved review back to pending and recomputes the rating', async () => {
      const product = new Types.ObjectId(productId);
      reviewModel.findOne.mockReturnValueOnce(
        query({
          _id: new Types.ObjectId(reviewId),
          product,
          status: ReviewStatus.APPROVED,
        }),
      );
      reviewModel.findOneAndUpdate.mockReturnValueOnce(
        query({ _id: reviewId, status: ReviewStatus.PENDING }),
      );

      await service.updateMine(userId, reviewId, { rating: 2 });

      const [filter, update] = reviewModel.findOneAndUpdate.mock.calls[0] as [
        Record<string, unknown>,
        { $set: Record<string, unknown> },
      ];
      // ownership is enforced in the write filter as well
      expect(String(filter.user)).toBe(userId);
      expect(update.$set).toEqual(
        expect.objectContaining({
          rating: 2,
          status: ReviewStatus.PENDING,
          isVerifiedPurchase: true,
        }),
      );
      expect(update.$set).not.toHaveProperty('comment');
      expect(emit).toHaveBeenCalledWith(
        REVIEW_EVENTS.CHANGED,
        expect.objectContaining({ productId: product }),
      );
      expect(emit).toHaveBeenCalledWith(
        REVIEW_EVENTS.SUBMITTED,
        expect.anything(),
      );
    });

    it('re-editing a still-pending review neither recomputes nor re-notifies admins', async () => {
      reviewModel.findOne.mockReturnValueOnce(
        query({
          _id: new Types.ObjectId(reviewId),
          product: new Types.ObjectId(productId),
          status: ReviewStatus.PENDING,
        }),
      );
      reviewModel.findOneAndUpdate.mockReturnValueOnce(
        query({ _id: reviewId }),
      );

      await service.updateMine(userId, reviewId, { comment: 'edited' });

      expect(emit).not.toHaveBeenCalled();
    });

    it('re-notifies admins when a rejected review is edited back into the queue', async () => {
      reviewModel.findOne.mockReturnValueOnce(
        query({
          _id: new Types.ObjectId(reviewId),
          product: new Types.ObjectId(productId),
          status: ReviewStatus.REJECTED,
        }),
      );
      reviewModel.findOneAndUpdate.mockReturnValueOnce(
        query({ _id: reviewId }),
      );

      await service.updateMine(userId, reviewId, { comment: 'edited' });

      expect(emit).toHaveBeenCalledWith(
        REVIEW_EVENTS.SUBMITTED,
        expect.anything(),
      );
      // rejected reviews were never part of the average
      expect(emit).not.toHaveBeenCalledWith(
        REVIEW_EVENTS.CHANGED,
        expect.anything(),
      );
    });
  });
});
