import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
} from 'src/products/shared/schemas/Product.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { Review, ReviewDocument } from '../shared/schemas/review.schema';
import { ReviewStatus } from '../shared/enums/review-status.enum';
import { CreateReviewDto } from '../shared/dto/create-review.dto';
import { UpdateReviewDto } from '../shared/dto/update-review.dto';
import {
  REVIEW_EVENTS,
  ReviewActivityEvent,
  ReviewChangedEvent,
} from '../shared/events/review.events';
import { ReviewEligibilityService } from './review-eligibility.service';

/**
 * Customer-side writes: create a review (once per product) and edit it.
 * Every write puts the review back into `pending` until an admin approves it.
 */
@Injectable()
export class ReviewsMutationService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly eligibility: ReviewEligibilityService,
    private readonly eventEmitter: EventEmitter2,
    private readonly i18n: CustomI18nService,
  ) {}

  // ------------ =============================== ---------- //
  // ------------ ======  create review   ====== ---------- //
  // ------------ =============================== ---------- //
  async create(userId: string, productId: string, dto: CreateReviewDto) {
    await this.assertProductReviewable(productId);

    // Checked before eligibility so an existing reviewer is always told
    // to edit their review instead of creating a new one.
    const alreadyReviewed = await this.reviewModel.exists({
      user: new Types.ObjectId(userId),
      product: new Types.ObjectId(productId),
    });
    if (alreadyReviewed) this.throwAlreadyReviewed();

    const isVerifiedPurchase = await this.eligibility.assertCanReview(
      userId,
      productId,
    );

    let review: ReviewDocument;
    try {
      review = await this.reviewModel.create({
        user: new Types.ObjectId(userId),
        product: new Types.ObjectId(productId),
        rating: dto.rating,
        comment: dto.comment,
        isVerifiedPurchase,
        status: ReviewStatus.PENDING,
      });
    } catch (error) {
      // Unique index {user, product} — concurrent duplicate submission
      if ((error as { code?: number })?.code === 11000) {
        this.throwAlreadyReviewed();
      }
      throw error;
    }

    this.eventEmitter.emit(
      REVIEW_EVENTS.SUBMITTED,
      new ReviewActivityEvent(review._id.toString(), productId, userId),
    );

    return {
      status: 'success',
      message: 'success.REVIEW_SUBMITTED',
      data: this.i18n.localize(review.toObject()),
    };
  }

  // ------------ =============================== ---------- //
  // ------------ ======  update my review   ====== ---------- //
  // ------------ =============================== ---------- //
  async updateMine(userId: string, reviewId: string, dto: UpdateReviewDto) {
    // Ownership is part of the filter — another user's review is a 404.
    const existing = await this.reviewModel
      .findOne({
        _id: new Types.ObjectId(reviewId),
        user: new Types.ObjectId(userId),
      })
      .select('product status')
      .lean();
    if (!existing) {
      throw new NotFoundException(
        this.i18n.translate('exception.review.NOT_FOUND'),
      );
    }

    // A soft-deleted / deactivated product is off the store — freeze its reviews.
    await this.assertProductReviewable(existing.product);

    // The user may have purchased the product after writing the review.
    const isVerifiedPurchase = await this.eligibility.hasPurchased(
      userId,
      existing.product,
    );

    const updated = await this.reviewModel
      .findOneAndUpdate(
        { _id: existing._id, user: new Types.ObjectId(userId) },
        {
          $set: {
            ...(dto.rating !== undefined && { rating: dto.rating }),
            ...(dto.comment !== undefined && { comment: dto.comment }),
            isVerifiedPurchase,
            status: ReviewStatus.PENDING,
            editedAt: new Date(),
          },
        },
        { new: true, runValidators: true },
      )
      .select('-__v')
      .lean();
    if (!updated) {
      throw new NotFoundException(
        this.i18n.translate('exception.review.NOT_FOUND'),
      );
    }

    const productId = existing.product.toString();
    // An approved review just left the public set → recompute the average.
    if (existing.status === ReviewStatus.APPROVED) {
      this.eventEmitter.emit(
        REVIEW_EVENTS.CHANGED,
        new ReviewChangedEvent(existing.product),
      );
    }
    // Notify admins only when an already-moderated review re-enters the queue.
    // Re-editing a still-pending review would otherwise let one user flood
    // every admin with notifications (up to the throttle limit per minute).
    if (existing.status !== ReviewStatus.PENDING) {
      this.eventEmitter.emit(
        REVIEW_EVENTS.SUBMITTED,
        new ReviewActivityEvent(reviewId, productId, userId),
      );
    }

    return {
      status: 'success',
      message: 'success.REVIEW_UPDATED',
      data: this.i18n.localize(updated),
    };
  }

  /** 404 unless the product is live on the store (active and not soft-deleted). */
  private async assertProductReviewable(productId: string | Types.ObjectId) {
    const productExists = await this.productModel.exists({
      _id: new Types.ObjectId(productId),
      isActive: true,
      isDeleted: { $ne: true },
    });
    if (!productExists) {
      throw new NotFoundException(
        this.i18n.translate('exception.review.PRODUCT_NOT_FOUND'),
      );
    }
  }

  private throwAlreadyReviewed(): never {
    throw new ConflictException(
      this.i18n.translate('exception.review.ALREADY_REVIEWED'),
    );
  }
}
