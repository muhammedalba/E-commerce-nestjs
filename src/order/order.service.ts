import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateOrderDto } from './shared/dto/create-order.dto';
import { UpdateOrderDto } from './shared/dto/update-order.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Product } from 'src/products/shared/schemas/Product.schema';
import { Order } from './shared/schemas/Order.schema';
import { Coupon } from 'src/coupons/shared/Schemas/coupons.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { I18nContext } from 'nestjs-i18n';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { EmailService } from 'src/email/email.service';
import { OrderHelperService } from './shared/order-helper/order-helper.service';

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
export class OrderService {
  constructor(
    @InjectModel(Order.name) private readonly OrderModel: Model<Order>,
    @InjectModel(Product.name) private readonly ProductModel: Model<Product>,
    private readonly i18n: CustomI18nService,
    private readonly fileUploadService: FileUploadService,
    private readonly orderHelperService: OrderHelperService,
  ) {}

  private getCurrentLang(): string {
    const lang =
      I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    return lang;
  }

  private async validateOrderItems(
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

      const product = await this.ProductModel.findById(item.productId)
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

  // async applyCoupon(userId: string, dto: CreateOrderDto) {
  //   let discountAmount = 0;

  //   const {
  //     validatedItems,
  //     totalPrice,
  //     totalQuantity,
  //     updatedProducts,
  //     unAvailableProducts,
  //   } = await this.validateOrderItems(dto.items);

  //   if (!dto.couponCode) {
  //     throw new BadRequestException('Coupon code is required');
  //   }

  //   const coupon = await this.couponModel.findOne({ name: dto.couponCode });

  //   if (!coupon) {
  //     throw new BadRequestException('Invalid or inactive coupon code');
  //   }

  //   this.validateCoupon(coupon, userId, totalPrice, validatedItems);

  //   if (coupon.type === 'percentage') {
  //     discountAmount = (totalPrice * coupon.discount) / 100;
  //   } else if (coupon.type === 'fixed') {
  //     discountAmount = coupon.discount;
  //   } else {
  //     throw new BadRequestException('Unsupported coupon type');
  //   }

  //   if (discountAmount > totalPrice) {
  //     throw new BadRequestException('Discount cannot exceed the total price');
  //   }

  //   const totalPriceAfterDiscount =
  //     Math.round((totalPrice - discountAmount) * 100) / 100;

  //   const couponDetails = {
  //     couponCode: coupon.name,
  //     discountAmount: coupon.discount,
  //   };

  //   return {
  //     success: 'success',
  //     message: 'Coupon applied successfully',
  //     data: {
  //       items: validatedItems,
  //       totalPrice,
  //       totalPriceAfterDiscount,
  //       totalQuantity,
  //       couponDetails,
  //     },
  //     updatedProducts: {
  //       message: 'Some products are not available',
  //       data: updatedProducts,
  //     },
  //     unAvailableProducts: {
  //       message: 'Some products are not available',
  //       data: unAvailableProducts,
  //     },
  //   };
  // }

  //

  async PaymentByBankTransfer(
    userId: string,
    user_email: string,
    dto: CreateOrderDto,
    file: MulterFileType,
  ) {
    const { validatedItems, totalPrice, totalQuantity, updatedProducts } =
      await this.validateOrderItems(dto.items);

    const productItemsId = validatedItems.map((item) => ({
      productId: item.product.id.toString(),
      quantity: item.quantity,
      totalPrice: item.totalPrice ?? 0,
    }));

    const { discountAmount, totalPriceAfterDiscount, couponDetails } =
      await this.orderHelperService.applyCouponIfAvailable(
        dto.couponCode,
        userId,
        totalPrice,
      );

    if (file) {
      const filePath = await this.fileUploadService.saveFileToDisk(
        file,
        'orders',
      );
      dto.transferReceiptImg = filePath;
    }

    const order = await this.OrderModel.create({
      user: userId,
      items: productItemsId,
      totalPrice,
      totalPriceAfterDiscount,
      totalQuantity,
      transferReceiptImg: dto.transferReceiptImg,
      isCheckedOut: true,
      paymentMethod: 'bankTransfer',
      shippingAddress: { ...dto.shippingAddress },
      shippingMethod: dto.shippingMethod || 'default',
      couponCode: dto.couponCode || undefined,
      discountAmount: dto.couponCode ? discountAmount : undefined,
    });

    await this.orderHelperService.updateProductStats(validatedItems);

    // await this.orderHelperService.sendOrderEmail(
    //   order,
    //   validatedItems,
    //   user_email,
    // );

    return {
      message: this.i18n.translate('success.ORDER_CREATED_SUCCESSFULLY'),
      success: 'success',
      ...(couponDetails && { couponDetails }),
      totalPrice,
      data: order,
      updatedProducts: {
        message: this.i18n.translate('order.someProductsNotAvailable'),
        data: updatedProducts,
      },
    };
  }

  // Methods for CRUD operations
  create(createOrderDto: CreateOrderDto) {
    return `This action adds a new order with payment method: ${createOrderDto.paymentMethod}`;
  }

  findAll() {
    return `This action returns all order`;
  }

  findOne(id: number) {
    return `This action returns a #${id} order`;
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} ${updateOrderDto.paymentMethod}order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
