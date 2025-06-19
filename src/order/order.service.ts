import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './shared/dto/create-order.dto';
import { UpdateOrderDto } from './shared/dto/update-order.dto';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Order } from './shared/schemas/Order.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { OrderHelperService } from './shared/order-helper/order-helper.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private readonly OrderModel: Model<Order>,
    private readonly i18n: CustomI18nService,
    private readonly fileUploadService: FileUploadService,
    private readonly orderHelperService: OrderHelperService,
  ) {}

  async applyCoupon(userId: string, dto: CreateOrderDto) {
    const {
      validatedItems,
      totalPrice,
      totalQuantity,
      updatedProducts,
      unAvailableProducts,
    } = await this.orderHelperService.validateOrderItems(dto.items);

    const { discountAmount, totalPriceAfterDiscount, couponDetails } =
      await this.orderHelperService.applyCouponIfAvailable(
        dto.couponCode,
        userId,
        totalPrice,
      );

    return {
      success: 'success',
      message: this.i18n.translate('success.APPLY_COUPON_SUCCESS'),
      data: {
        items: validatedItems,
        totalPrice,
        totalPriceAfterDiscount,
        discountAmount,
        totalQuantity,
        couponDetails,
      },
      updatedProducts: {
        message: this.i18n.translate(
          'exception.coupon.SOME_PRODUCTS_HAVE_LESS_QUANTITY',
        ),
        data: updatedProducts,
      },
      unAvailableProducts: {
        message: this.i18n.translate('exception.coupon.INVALID_SOME_PRODUCTS'),
        data: unAvailableProducts,
      },
    };
  }

  async PaymentByBankTransfer(
    userId: string,
    user_email: string,
    dto: CreateOrderDto,
    file: MulterFileType,
  ) {
    const { validatedItems, totalPrice, totalQuantity, updatedProducts } =
      await this.orderHelperService.validateOrderItems(dto.items);

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
    if (couponDetails) {
      await this.orderHelperService.markCouponAsUsed(
        couponDetails.CouponId,
        userId,
      );
    }
    await this.orderHelperService.updateProductStats(validatedItems);

    await this.orderHelperService.sendOrderEmail(
      order,
      validatedItems,
      user_email,
    );

    return {
      success: 'success',
      message: this.i18n.translate('success.ORDER_CREATED_SUCCESSFULLY'),
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
