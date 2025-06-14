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

type validatedItems = Array<{
  product: {
    id: Types.ObjectId;
    imageCover?: string;
    brand: string;
    category: string;
    title?: string;
    price: number;
  };
  quantity: number;
  totalPrice?: number;
}>;

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private readonly OrderModel: Model<Order>,
    @InjectModel(Coupon.name) private readonly couponModel: Model<Coupon>,
    @InjectModel(Product.name) private readonly ProductModel: Model<Product>,
    protected readonly i18n: CustomI18nService,
    protected readonly fileUploadService: FileUploadService,
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
  ) {
    // Check coupon existence
    if (!coupon) {
      throw new BadRequestException('Invalid coupon code');
    }

    // Check if coupon is active
    if (!coupon.active) {
      throw new BadRequestException('Coupon is not currently active');
    }

    // Check if coupon is expired
    if (coupon.expires && coupon.expires < new Date()) {
      throw new BadRequestException('Coupon has expired');
    }

    // Check maximum usage limit
    if (coupon.maxUsage && coupon.maxUsage <= (coupon.usageCount || 0)) {
      throw new BadRequestException('Coupon usage limit exceeded');
    }

    // Check if user has already used the coupon
    if (coupon.usedByUsers?.includes(userId)) {
      throw new BadRequestException('You have already used this coupon');
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && totalPrice < coupon.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount to use this coupon is ${coupon.minOrderAmount}`,
      );
    }

    // Check maximum order amount
    if (coupon.maxOrderAmount && totalPrice > coupon.maxOrderAmount) {
      throw new BadRequestException(
        `Maximum order amount to use this coupon is ${coupon.maxOrderAmount}`,
      );
    }

    // Check if coupon applies to specific items (brands, categories, or products)
    if (coupon.appleTo !== 'all') {
      const allowedItems = coupon.appleItems || [];

      const isInvalidItem = validatedItems.some((item) => {
        const value =
          coupon.appleTo === 'brands'
            ? item.product.brand
            : coupon.appleTo === 'categories'
              ? item.product.category
              : item.product.id.toString();

        return !allowedItems.includes(value);
      });
      if (isInvalidItem) {
        throw new BadRequestException(
          'Coupon does not apply to some items in the order',
        );
      }
    }

    return coupon;
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
          'title price priceAfterDiscount quantity disabled SineLimit brand category imageCover',
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
  //   let totalPrice = 0;
  //   let totalQuantity = 0;
  //   let discountAmount = 0;
  //   // const baseUrl = process.env.BASE_URL;
  //   const validatedItems: validatedItems = [];

  //   const updatedProducts: Array<{
  //     productId: string;
  //     availableQuantity: number;
  //     RequiredQuantity: number;
  //     title: string;
  //   }> = [];

  //   const unAvailableProducts: Array<{ productId: string }> = [];

  //   // Step 1: Validate product items in the order
  //   for (const item of dto.items) {
  //     // 1.1 Validate product ID format
  //     if (!Types.ObjectId.isValid(item.productId)) {
  //       throw new BadRequestException(`Invalid product ID: ${item.productId}`);
  //     }

  //     // 1.2 Fetch product details
  //     const product = await this.ProductModel.findById(item.productId)
  //       .select(
  //         'title price priceAfterDiscount quantity disabled SineLimit brand category imageCover',
  //       )
  //       .exec();

  //     // 1.3 Check if product exists and is not disabled
  //     if (!product || product.disabled) {
  //       unAvailableProducts.push({ productId: item.productId.toString() });
  //       continue;
  //     }

  //     // 1.4 Check stock availability
  //     if (!product.SineLimit && product.quantity < item.quantity) {
  //       updatedProducts.push({
  //         productId: product._id.toString(),
  //         availableQuantity: product.quantity,
  //         RequiredQuantity: item.quantity,
  //         title: product.title,
  //       });
  //       continue;
  //     }

  //     // 1.5 Accumulate item data and calculate totals
  //     const price = product.priceAfterDiscount ?? product.price;
  //     const itemTotal = price * item.quantity;
  //     const lang = this.getCurrentLang();
  //     // 1.6 Handle translations for product title
  //     const translatedTitle =
  //       typeof product.get(`title.${lang}`) === 'string'
  //         ? (product.get(`title.${lang}`) as string)
  //         : product.title;
  //     // 1.7 Push validated item to the array
  //     validatedItems.push({
  //       product: {
  //         id: product._id,
  //         brand: product.brand?.toString() || '',
  //         category: product.category?.toString() || '',
  //         title: translatedTitle,
  //         price,
  //         imageCover: product.imageCover,
  //       },
  //       quantity: item.quantity,
  //       totalPrice: itemTotal,
  //     });

  //     totalPrice += itemTotal;
  //     totalQuantity += item.quantity;
  //   }

  //   totalPrice = Math.round(totalPrice * 100) / 100;

  //   // Step 2: Validate and apply the coupon
  //   if (!dto.couponCode) {
  //     throw new BadRequestException('Coupon code is required');
  //   }

  //   const coupon = await this.couponModel.findOne({ name: dto.couponCode });

  //   if (!coupon) {
  //     throw new BadRequestException('Invalid or inactive coupon code');
  //   }
  //   this.validateCoupon(coupon, userId, totalPrice, validatedItems);
  //   // Step 3: Calculate discount
  //   if (coupon.type === 'percentage') {
  //     discountAmount = (totalPrice * coupon.discount) / 100;
  //   } else if (coupon.type === 'fixed') {
  //     discountAmount = coupon.discount;
  //   } else {
  //     throw new BadRequestException('Unsupported coupon type');
  //   }

  //   // Step 3.1: Ensure discount doesn't exceed total price
  //   if (discountAmount > totalPrice) {
  //     throw new BadRequestException('Discount cannot exceed the total price');
  //   }

  //   // Step 3.2: Calculate final price
  //   const totalPriceAfterDiscount =
  //     Math.round((totalPrice - discountAmount) * 100) / 100;

  //   // Step 4: Prepare coupon details
  //   const couponDetails = {
  //     couponCode: coupon.name,
  //     discountAmount: coupon.discount,
  //   };

  //   // Return the final result
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

  async applyCoupon(userId: string, dto: CreateOrderDto) {
    let discountAmount = 0;

    const {
      validatedItems,
      totalPrice,
      totalQuantity,
      updatedProducts,
      unAvailableProducts,
    } = await this.validateOrderItems(dto.items);

    if (!dto.couponCode) {
      throw new BadRequestException('Coupon code is required');
    }

    const coupon = await this.couponModel.findOne({ name: dto.couponCode });

    if (!coupon) {
      throw new BadRequestException('Invalid or inactive coupon code');
    }

    this.validateCoupon(coupon, userId, totalPrice, validatedItems);

    if (coupon.type === 'percentage') {
      discountAmount = (totalPrice * coupon.discount) / 100;
    } else if (coupon.type === 'fixed') {
      discountAmount = coupon.discount;
    } else {
      throw new BadRequestException('Unsupported coupon type');
    }

    if (discountAmount > totalPrice) {
      throw new BadRequestException('Discount cannot exceed the total price');
    }

    const totalPriceAfterDiscount =
      Math.round((totalPrice - discountAmount) * 100) / 100;

    const couponDetails = {
      couponCode: coupon.name,
      discountAmount: coupon.discount,
    };

    return {
      success: 'success',
      message: 'Coupon applied successfully',
      data: {
        items: validatedItems,
        totalPrice,
        totalPriceAfterDiscount,
        totalQuantity,
        couponDetails,
      },
      updatedProducts: {
        message: 'Some products are not available',
        data: updatedProducts,
      },
      unAvailableProducts: {
        message: 'Some products are not available',
        data: unAvailableProducts,
      },
    };
  }

  async PaymentByBankTransfer(userId: string, dto: CreateOrderDto) {
    if (dto.transferReceiptImg) {
      throw new BadRequestException('Transfer receipt image is required');
    }
    // 1) Validate the order items
    const {
      validatedItems,
      totalPrice,
      totalQuantity,
      updatedProducts,
      unAvailableProducts,
    } = await this.validateOrderItems(dto.items);
    // 2) Check if the user has provided a coupon code
    if (dto.couponCode) {
      let discountAmount = 0;
      const coupon = await this.couponModel.findOne({ name: dto.couponCode });
      if (!coupon) {
        throw new BadRequestException('Invalid or inactive coupon code');
      }
      this.validateCoupon(coupon, userId, totalPrice, validatedItems);
      if (coupon.type === 'percentage') {
        discountAmount = (totalPrice * coupon.discount) / 100;
      } else if (coupon.type === 'fixed') {
        discountAmount = coupon.discount;
      } else {
        throw new BadRequestException('Unsupported coupon type');
      }

      if (discountAmount > totalPrice) {
        throw new BadRequestException('Discount cannot exceed the total price');
      }

      const totalPriceAfterDiscount =
        Math.round((totalPrice - discountAmount) * 100) / 100;
      // update the coupon usage count and usedByUsers
      coupon.usageCount = (coupon.usageCount || 0) + 1;
      coupon.usedByUsers = coupon.usedByUsers || [];
      coupon.usedByUsers.push(userId);

      await coupon.save();

      const couponDetails = {
        couponCode: coupon.name,
        discountAmount: coupon.discount,
      };
      // 3) Create the order object with coupon details
      const order = await this.OrderModel.create({
        user: userId,
        items: validatedItems,
        totalPrice: totalPriceAfterDiscount,
        totalQuantity,
        isCheckedOut: true,
        paymentMethod: 'bankTransfer',
        shippingAddress: dto.shippingAddress,
        shippingMethod: dto.shippingMethod || 'default',
        couponCode: dto.couponCode,
        discountAmount,
      });

      return {
        message: 'تم إنشاء الطلب بنجاح',
        success: 'success',
        totalPriceAfterDiscount,
        couponDetails,
        data: order,
      };
    }

    //3) Create the order object
    // const order = new this.OrderModel({
    //   user: userId,
    //   items: validatedItems,
    //   totalPrice,
    //   totalQuantity,
    //   isCheckedOut: true,
    //   paymentMethod: 'bankTransfer',
    //   shippingAddress: dto.shippingAddress,
    //   shippingMethod: dto.shippingMethod || 'default',
    // });
    // 4) Save the order to the database
    // const createdOrder = await order.save();

    // 6) Return the success message
    // if (updatedProducts.length > 0 || unAvailableProducts.length > 0) {
    //   return {
    //     message: this.i18n.t('order.orderCreatedWithSomeProductsNotAvailable', {
    //       lang: this.getCurrentLang(),
    //     }),
    //     success: 'success',
    //     data: createdOrder,
    //     updatedProducts: {
    //       message: this.i18n.t('order.someProductsNotAvailable', {
    //         lang: this.getCurrentLang(),
    //       }),
    //       data: updatedProducts,
    //     },
    //     unAvailableProducts: {
    //       message: this.i18n.t('order.someProductsNotAvailable', {
    //         lang: this.getCurrentLang(),
    //       }),
    //       data: unAvailableProducts,
    //     },
    //   };
    // }
    return {
      message: 'تم إنشاء الطلب بنجاح',
      success: 'success',
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
