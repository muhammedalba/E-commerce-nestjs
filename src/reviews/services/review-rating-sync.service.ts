import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { Model, Types } from 'mongoose';
import {
  Product,
  ProductDocument,
} from 'src/products/shared/schemas/Product.schema';
import { CacheInvalidationService } from 'src/shared/services/cache-invalidation.service';
import { RevalidationService } from 'src/shared/services/revalidation.service';
import { Review, ReviewDocument } from '../shared/schemas/review.schema';
import { ReviewStatus } from '../shared/enums/review-status.enum';
import {
  REVIEW_EVENTS,
  ReviewChangedEvent,
} from '../shared/events/review.events';

/**
 * Keeps `Product.ratingsAverage` / `Product.ratingsQuantity` in sync with the
 * product's **approved** reviews.
 */
@Injectable()
export class ReviewRatingSyncService {
  private readonly logger = new Logger(ReviewRatingSyncService.name);

  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly revalidationService: RevalidationService,
  ) {}

  @OnEvent(REVIEW_EVENTS.CHANGED, { async: true })
  async handleReviewChanged(event: ReviewChangedEvent) {
    const productId = new Types.ObjectId(event.productId);
    try {
      const [stats] = await this.reviewModel.aggregate<{
        average: number;
        count: number;
      }>([
        { $match: { product: productId, status: ReviewStatus.APPROVED } },
        {
          $group: {
            _id: null,
            average: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ]);

      const product = await this.productModel.findOneAndUpdate(
        { _id: productId },
        {
          $set: {
            ratingsAverage: stats ? Math.round(stats.average * 10) / 10 : 0,
            ratingsQuantity: stats?.count ?? 0,
          },
        },
        { projection: { slug: 1 } },
      );

      await this.cacheInvalidation.clearResources(['products']);
      await this.revalidationService.revalidate([
        'products',
        ...(product?.slug ? [`product-${product.slug}`] : []),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to sync ratings for product ${productId.toString()}`,
        error,
      );
    }
  }
}
