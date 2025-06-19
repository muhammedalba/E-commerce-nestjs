import {
  BadRequestException,
  BadGatewayException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Coupon } from 'src/coupons/shared/Schemas/coupons.schema';
import { EmailService } from 'src/email/email.service';
import { Product } from 'src/products/shared/schemas/Product.schema';
import { HydratedDocument } from 'mongoose';
import { Order } from '../schemas/Order.schema';

type OrderDocument = HydratedDocument<Order>;

type ValidatedItem = {
  product: {
    id: Types.ObjectId;
    imageCover: string;
    brand: string;
    category: string;
    title: string;
    price: number;
    quantity: number;
    sold: number;
    SineLimit?: boolean;
  };
  quantity: number;
  totalPrice?: number;
};
type validatedItems = Array<{
  product: {
    id: Types.ObjectId;
    imageCover: string;
    brand: string;
    category: string;
    title: string;
    price: number;
    quantity: number;
    sold: number;
    SineLimit?: boolean;
  };
  quantity: number;
  totalPrice?: number;
}>;
@Injectable()
export class OrderHelperService {
  constructor(
    @InjectModel(Coupon.name) private readonly couponModel: Model<Coupon>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
  ) {}
  private getCurrentLang(): string {
    const lang =
      I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    return lang;
  }
  private validateCoupon(
    coupon: Coupon,
    userId: string,
    totalPrice: number,
    validatedItems: {
      product: { id: Types.ObjectId; brand: string; category: string };
      quantity: number;
    }[],
  ): void {
    if (!coupon) {
      throw new BadRequestException(
        this.i18n.translate('exception.coupon.INVALID_COUPON'),
      );
    }

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
  async validateOrderItems(
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<{
    validatedItems: validatedItems;
    totalPrice: number;
    totalQuantity: number;
    updatedProducts: Array<{
      productId: string;
      availableQuantity: number;
      RequiredQuantity: number;
      title: string;
    }>;
    unAvailableProducts: Array<{ productId: string }>;
  }> {
    const validatedItems: validatedItems = [];
    const updatedProducts: Array<{
      productId: string;
      availableQuantity: number;
      RequiredQuantity: number;
      title: string;
    }> = [];

    const unAvailableProducts: Array<{ productId: string }> = [];
    let totalPrice = 0;
    let totalQuantity = 0;

    const lang = this.getCurrentLang();

    for (const item of items) {
      if (!Types.ObjectId.isValid(item.productId)) {
        throw new BadRequestException(`Invalid product ID: ${item.productId}`);
      }

      const product = await this.productModel
        .findById(item.productId)
        .select(
          'title price priceAfterDiscount SineLimit quantity sold disabled SineLimit brand category imageCover',
        )
        .exec();

      if (!product || product.disabled) {
        unAvailableProducts.push({ productId: item.productId.toString() });
        continue;
      }
      const translatedTitle =
        typeof product.get(`title.${lang}`) === 'string'
          ? (product.get(`title.${lang}`) as string)
          : product.title;

      if (!product.SineLimit && product.quantity < item.quantity) {
        updatedProducts.push({
          productId: product._id.toString(),
          availableQuantity: product.quantity,
          RequiredQuantity: item.quantity,
          title: translatedTitle,
        });
        continue;
      }

      const price = product.priceAfterDiscount ?? product.price;
      const itemTotal = price * item.quantity;

      validatedItems.push({
        product: {
          id: product._id,
          brand: product.brand?.toString() || '',
          category: product.category?.toString() || '',
          title: translatedTitle,
          price,
          quantity: product.quantity,
          sold: product.sold || 0,
          imageCover: product.imageCover,
        },
        quantity: item.quantity,
        totalPrice: itemTotal,
      });

      totalPrice += itemTotal;
      totalQuantity += item.quantity;
    }

    totalPrice = Math.round(totalPrice * 100) / 100;

    return {
      validatedItems,
      totalPrice,
      totalQuantity,
      updatedProducts,
      unAvailableProducts,
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

  async applyCouponIfAvailable(
    couponCode: string | undefined,
    userId: string,
    totalPrice: number,
    validatedItems: {
      product: { id: Types.ObjectId; brand: string; category: string };
      quantity: number;
    }[] = [],
  ): Promise<{
    discountAmount: number;
    totalPriceAfterDiscount: number;
    couponDetails: {
      couponCode: string;
      discountAmount: number;
      CouponId: Types.ObjectId;
    } | null;
  }> {
    if (!couponCode) {
      return {
        discountAmount: 0,
        totalPriceAfterDiscount: totalPrice,
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

    const discountAmount = Math.min(rawDiscount, totalPrice);
    const totalPriceAfterDiscount =
      Math.round((totalPrice - discountAmount) * 100) / 100;

    return {
      discountAmount,
      totalPriceAfterDiscount,
      couponDetails: {
        couponCode: coupon.name,
        CouponId: coupon._id,
        discountAmount,
      },
    };
  }

  async updateProductStats(validatedItems: ValidatedItem[]) {
    const bulkOptions = validatedItems.map((product) => {
      const newSold = (product.product.sold || 0) + product.quantity;
      let newQuantity = product.product.quantity - product.quantity;
      if (!product.product.SineLimit && newQuantity <= 0) {
        newQuantity = 0;
      }
      return {
        updateOne: {
          filter: { _id: product.product.id },
          update: {
            $set: {
              sold: newSold,
              quantity: newQuantity,
            },
          },
        },
      };
    });

    await this.productModel.bulkWrite(bulkOptions);
  }

  async sendOrderEmail(
    order: OrderDocument,
    validatedItems: ValidatedItem[],
    user_email: string,
  ) {
    try {
      await this.emailService.new_admin_order(
        process.env.APP_NAME || 'admin',
        user_email,
        order.createdAt ? order.createdAt.toISOString() : '',
        order.totalPriceAfterDiscount?.toString() ??
          order.totalPrice.toString(),
        `${process.env.BASE_URL}/api/v1/order/${order._id?.toString() ?? ''}`,
        order._id?.toString() ?? '',
        validatedItems.map((item) => ({
          product: {
            id: item.product.id.toString(),
            title: item.product.title,
            price: item.product.price.toString(),
            quantity: item.product.quantity.toString(),
            imageCover: item.product.imageCover,
          },
          quantity: item.quantity.toString(),
          totalPrice:
            item.totalPrice?.toString() ??
            (item.product.price * item.quantity).toString(),
        })),
        this.i18n.translate('email.NEW_ORDER_SUBJECT', {
          args: { name: 'codeProps' },
        }),
      );
    } catch {
      throw new BadGatewayException(
        this.i18n.translate('exception.EMAIL_SEND_FAILED'),
      );
    }
  }
}
