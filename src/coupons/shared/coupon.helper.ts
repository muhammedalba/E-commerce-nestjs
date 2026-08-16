import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { I18nService } from 'nestjs-i18n';
import { Coupon } from 'src/coupons/shared/Schemas/coupons.schema';

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
      const allowedItems = coupon.applyItems || [];

      const hasEligibleItem = validatedItems.some((item) => {
        const value =
          coupon.applyTo === 'brands'
            ? item.product.brand.toString()
            : coupon.applyTo === 'categories'
              ? item.product.category
              : item.product.id.toString();

        return allowedItems.includes(value);
      });

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
  ): Promise<{
    discountAmount: number;
    totalPriceAfterDiscount?: number;
    totalPrice: number;
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
    let discountBase = totalPrice;
    if (coupon.applyTo !== 'all') {
      const allowedItems = coupon.applyItems || [];
      discountBase = validatedItems
        .filter((item) => {
          const value =
            coupon.applyTo === 'brands'
              ? item.product.brand.toString()
              : coupon.applyTo === 'categories'
                ? item.product.category
                : item.product.id.toString();
          return allowedItems.includes(value);
        })
        .reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    const rawDiscount =
      coupon.type === 'percentage'
        ? (discountBase * coupon.discount) / 100
        : coupon.discount;

    // Discount must not exceed the eligible subtotal
    const discountAmount = Math.min(rawDiscount, discountBase);

    const totalPriceAfterDiscount =
      Math.round((totalPrice - discountAmount) * 100) / 100;
    return {
      discountAmount,
      totalPrice,
      totalPriceAfterDiscount,
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
}
