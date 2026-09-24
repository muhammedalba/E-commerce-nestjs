import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CacheInvalidationService } from 'src/shared/services/cache-invalidation.service';
import {
  USER_EVENTS,
  UserDeletedEvent,
} from 'src/users/shared/events/user.events';
import {
  PRODUCT_EVENTS,
  ProductDeletedEvent,
} from 'src/products/shared/events/product.events';
import { Review, ReviewDocument } from '../shared/schemas/review.schema';
import { ReviewStatus } from '../shared/enums/review-status.enum';
import {
  REVIEW_EVENTS,
  ReviewChangedEvent,
} from '../shared/events/review.events';

/**
 * Removes reviews whose owner (user) or subject (product) was permanently
 * deleted, so they don't linger as orphans in the moderation list and stats.
 *
 * Both handlers run after the deletion is committed, so they log instead of
 * throwing.
 */
@Injectable()
export class ReviewCleanupListener {
  private readonly logger = new Logger(ReviewCleanupListener.name);

  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  // ------------ ======  user deleted  ====== ---------- //
  @OnEvent(USER_EVENTS.DELETED, { async: true })
  async handleUserDeleted(event: UserDeletedEvent) {
    try {
      const user = new Types.ObjectId(event.userId);

      // Only approved reviews count towards product ratings
      const affectedProducts = await this.reviewModel.distinct('product', {
        user,
        status: ReviewStatus.APPROVED,
      });

      const { deletedCount } = await this.reviewModel.deleteMany({ user });
      if (!deletedCount) return;

      for (const productId of affectedProducts) {
        this.eventEmitter.emit(
          REVIEW_EVENTS.CHANGED,
          new ReviewChangedEvent(productId),
        );
      }

      // Public review lists are cached per product
      await this.cacheInvalidation.clearResources(['reviews']);
    } catch (error) {
      this.logger.error(
        `Failed to clean up reviews of deleted user ${event.userId}`,
        error,
      );
    }
  }

  // ------------ ======  product hard-deleted  ====== ---------- //
  @OnEvent(PRODUCT_EVENTS.DELETED, { async: true })
  async handleProductDeleted(event: ProductDeletedEvent) {
    try {
      // No rating recompute — the product itself no longer exists
      const { deletedCount } = await this.reviewModel.deleteMany({
        product: new Types.ObjectId(event.productId),
      });
      if (!deletedCount) return;

      await this.cacheInvalidation.clearResources(['reviews']);
    } catch (error) {
      this.logger.error(
        `Failed to clean up reviews of deleted product ${event.productId}`,
        error,
      );
    }
  }
}
