import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from 'src/order/shared/schemas/Order.schema';
import { OrderStatus } from 'src/order/shared/enums/order-status.enum';
import { SettingsService } from 'src/settings/settings.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

/**
 * Decides whether a user may review a product, based on purchase history
 * and the `features.reviewsVerifiedOnly` store setting.
 */
@Injectable()
export class ReviewEligibilityService {
  // Order statuses indicating that the product has actually reached the customer
  private static readonly PURCHASED_STATUSES = [
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
  ];

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    private readonly settingsService: SettingsService,
    private readonly i18n: CustomI18nService,
  ) {}

  /** Whether the user has a delivered/completed order containing the product. */
  async hasPurchased(
    userId: string,
    productId: string | Types.ObjectId,
  ): Promise<boolean> {
    const order = await this.orderModel.exists({
      user: new Types.ObjectId(userId),
      'items.productId': new Types.ObjectId(productId),
      status: { $in: ReviewEligibilityService.PURCHASED_STATUSES },
      isDeleted: { $ne: true },
    });
    return !!order;
  }

  /**
   * Returns the user's purchase state and whether they are allowed to review.
   * Used by `GET /reviews/product/:productId/me` so the UI knows what to render.
   *
   * verifiedOnly | isVerifiedPurchase | canReview | Reason
   * false          | Any value         | ✅ true   | Settings open to all
   * true           | true              | ✅ true   | Restricted, but purchased
   * true           | false             | ❌ false  | Restricted and did not purchase
   */
  async getEligibility(
    userId: string,
    productId: string,
  ): Promise<{ isVerifiedPurchase: boolean; canReview: boolean }> {
    const [isVerifiedPurchase, verifiedOnly] = await Promise.all([
      //  Did the customer buy the product?
      this.hasPurchased(userId, productId),
      //  Is the feature enabled?
      this.settingsService.isReviewsVerifiedOnly(),
    ]);
    return {
      isVerifiedPurchase,
      canReview: !verifiedOnly || isVerifiedPurchase,
    };
  }

  /**
   * Throws when reviews are restricted to buyers and the user never bought
   * the product. Returns the computed `isVerifiedPurchase` flag otherwise.
   */
  async assertCanReview(userId: string, productId: string): Promise<boolean> {
    const { isVerifiedPurchase, canReview } = await this.getEligibility(
      userId,
      productId,
    );
    if (!canReview) {
      throw new ForbiddenException(
        this.i18n.translate('exception.review.PURCHASE_REQUIRED'),
      );
    }
    return isVerifiedPurchase;
  }
}
