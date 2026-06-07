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

    if (coupon.applyTo !== 'all') {
      const allowedItems = coupon.applyItems || [];

      const isInvalidItem = validatedItems.some((item) => {
        const value =
          coupon.applyTo === 'brands'
            ? item.product.brand.toString()
            : coupon.applyTo === 'categories'
              ? item.product.category
              : item.product.id.toString();

        return !allowedItems.includes(value);
      });

      if (isInvalidItem) {
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
      CouponId: Types.ObjectId;
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

    const rawDiscount =
      coupon.type === 'percentage'
        ? (totalPrice * coupon.discount) / 100
        : coupon.discount;

    //if rawDiscount > totalPrice
    const discountAmount = Math.min(rawDiscount, totalPrice);

    const totalPriceAfterDiscount =
      Math.round((totalPrice - discountAmount) * 100) / 100;
    return {
      discountAmount,
      totalPrice,
      totalPriceAfterDiscount,
      couponDetails: {
        couponCode: coupon.name,
        CouponId: coupon._id,
        couponType: coupon.type,
        discount: coupon.discount,
      },
    };
  }

  async markCouponAsUsed(
    CouponId: Types.ObjectId,
    userId: string,
  ): Promise<void> {
    await this.couponModel
      .updateOne(
        { _id: CouponId },
        {
          $inc: { usageCount: 1 },
          $addToSet: { usedByUsers: userId },
        },
      )
      .exec();
  }
}
