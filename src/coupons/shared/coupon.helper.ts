import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { I18nService } from 'nestjs-i18n';
import { Coupon } from 'src/coupons/shared/Schemas/coupons.schema';
import { roundMoney } from 'src/payments/shared/utils/currency.util';
import {
  allocateCouponDiscount,
  isCouponEligible,
  ScopedLine,
} from './coupon-allocation';

/** A checkout item as the coupon scope sees it. */
const scopedLine = (item: {
  product: { id: Types.ObjectId; brand: string; category: string };
}): ScopedLine => ({
  productId: item.product.id,
  brand: item.product.brand,
  category: item.product.category,
});

@Injectable()
export class CouponHelperService {
  constructor(
    @InjectModel(Coupon.name) private readonly couponModel: Model<Coupon>,
    private readonly i18n: I18nService,
  ) {}

  private validateCoupon(
    coupon: Coupon,
    userId: string,
    totalPrice: number,
    validatedItems: {
      product: { id: Types.ObjectId; brand: string; category: string };
      quantity: number;
    }[],
  ): void {
    if (!coupon.active) {
      throw new BadRequestException(
        this.i18n.translate('exception.coupon.INACTIVE_COUPON'),
      );
    }

    if (coupon.expires && coupon.expires < new Date()) {
      throw new BadRequestException(
        this.i18n.translate('exception.coupon.EXPIRED_COUPON'),
      );
    }

    if (coupon.maxUsage && coupon.maxUsage <= (coupon.usageCount || 0)) {
      throw new BadRequestException(
        this.i18n.translate('exception.coupon.USAGE_LIMIT_EXCEEDED'),
      );
    }

    if (coupon.usedByUsers?.includes(userId)) {
      throw new BadRequestException(
        this.i18n.translate('exception.coupon.ALREADY_USED'),
      );
    }

    if (coupon.minOrderAmount && totalPrice < coupon.minOrderAmount) {
      throw new BadRequestException(
        this.i18n.translate('exception.coupon.MIN_ORDER_AMOUNT', {
          args: { amount: coupon.minOrderAmount },
        }),
      );
    }

    if (coupon.maxOrderAmount && totalPrice > coupon.maxOrderAmount) {
      throw new BadRequestException(
        this.i18n.translate('exception.coupon.MAX_ORDER_AMOUNT', {
          args: { amount: coupon.maxOrderAmount },
        }),
      );
    }

    // For scoped coupons: at least one item in the order must be eligible.
    // Non-eligible items are simply not discounted (handled in applyCouponIfAvailable).
    if (coupon.applyTo !== 'all') {
      const hasEligibleItem = validatedItems.some((item) =>
        isCouponEligible(coupon, scopedLine(item)),
      );

      if (!hasEligibleItem) {
        throw new BadRequestException(
          this.i18n.translate('exception.coupon.INVALID_ITEMS_IN_ORDER'),
        );
      }
    }
  }
  //
  async applyCouponIfAvailable(
    couponCode: string | undefined,
    userId: string,
    totalPrice: number,
    validatedItems: {
      product: { id: Types.ObjectId; brand: string; category: string };
      quantity: number;
      variantId: string;
      weight: number;
      price: number;
    }[] = [],
    /** The store currency: amounts round to its smallest unit (default 2 decimals). */
    currency?: string,
  ): Promise<{
    discountAmount: number;
    totalPriceAfterDiscount?: number;
    totalPrice: number;
    /**
     * Each item's share of the discount, in `validatedItems` order: the items
     * the coupon covers share it, the others get 0; it adds up to the
     * discount to the halala. Frozen on the order lines (credit notes).
     */
    lineDiscounts: number[];
    couponDetails: {
      couponCode: string;
      discount: number;
      couponId: Types.ObjectId;
      couponType: string;
    } | null;
  }> {
    if (!couponCode) {
      return {
        discountAmount: 0,
        totalPrice,
        lineDiscounts: validatedItems.map(() => 0),
        couponDetails: null,
      };
    }

    const coupon = await this.couponModel.findOne({ name: couponCode });
    if (!coupon) {
      throw new BadRequestException(
        this.i18n.translate('exception.coupon.INVALID_COUPON'),
      );
    }

    this.validateCoupon(coupon, userId, totalPrice, validatedItems);

    // Determine the price base for discount calculation.
    // For scoped coupons, discount applies only to eligible items' subtotal.
    const eligible = validatedItems.map((item) =>
      isCouponEligible(coupon, scopedLine(item)),
    );
    let discountBase = totalPrice;
    if (coupon.applyTo !== 'all') {
      discountBase = validatedItems
        .filter((_, i) => eligible[i])
        .reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    const rawDiscount =
      coupon.type === 'percentage'
        ? (discountBase * coupon.discount) / 100
        : coupon.discount;

    // Discount must not exceed the eligible subtotal; in the currency's
    // smallest unit, like every amount of the order
    const discountAmount = roundMoney(
      Math.min(rawDiscount, discountBase),
      currency,
    );

    const totalPriceAfterDiscount = roundMoney(
      totalPrice - discountAmount,
      currency,
    );
    return {
      discountAmount,
      totalPrice,
      totalPriceAfterDiscount,
      lineDiscounts: allocateCouponDiscount(
        discountAmount,
        validatedItems.map((item, i) => ({
          price: item.price,
          quantity: item.quantity,
          eligible: eligible[i],
        })),
        currency,
      ),
      couponDetails: {
        couponCode: coupon.name,
        couponId: coupon._id,
        couponType: coupon.type,
        discount: coupon.discount,
      },
    };
  }

  async markCouponAsUsed(
    couponId: Types.ObjectId,
    userId: string,
  ): Promise<void> {
    const coupon = await this.couponModel.findOneAndUpdate(
      {
        _id: couponId,
        active: true,
        usedByUsers: { $ne: userId },
        $or: [
          { maxUsage: 0 },
          { maxUsage: { $exists: false } },
          { $expr: { $gt: ['$maxUsage', '$usageCount'] } },
        ],
      },
      { $addToSet: { usedByUsers: userId }, $inc: { usageCount: 1 } },
      { new: true },
    );

    if (!coupon) {
      throw new BadRequestException(
        'ALREADY_USED, EXCEEDED_LIMIT, or INVALID_COUPON',
      );
    }
  }

  /**
   * Undoes markCouponAsUsed for an order that was fully refunded before
   * shipping, so the customer can use the coupon again. Conditional on the
   * user still being recorded, so repeating it never lowers the count twice.
   *
   * @returns Whether a usage was released.
   */
  async releaseCouponUsage(
    couponId: Types.ObjectId,
    userId: string,
  ): Promise<boolean> {
    const coupon = await this.couponModel.findOneAndUpdate(
      { _id: couponId, usedByUsers: userId, usageCount: { $gt: 0 } },
      { $pull: { usedByUsers: userId }, $inc: { usageCount: -1 } },
    );
    return !!coupon;
  }
}
