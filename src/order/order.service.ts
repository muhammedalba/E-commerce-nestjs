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
import { OrderEmailService } from './shared/order-helper/order-email.service';
import { CouponHelperService } from './shared/order-helper/coupon.helper';
import { ProductHelperService } from './shared/order-helper/product.helper';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private readonly OrderModel: Model<Order>,
    private readonly i18n: CustomI18nService,
    private readonly fileUploadService: FileUploadService,
    private readonly orderHelperService: OrderHelperService,
    private readonly orderEmailService: OrderEmailService,
    private readonly productHelperService: ProductHelperService,
    private readonly couponHelperService: CouponHelperService,
  ) {}

  async applyCoupon(userId: string, dto: CreateOrderDto) {
    return await this.couponHelperService.applyCoupon(userId, dto);
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
      await this.couponHelperService.applyCouponIfAvailable(
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
    const newOrder = {
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
    };
    const order = await this.OrderModel.create(newOrder);
    if (couponDetails) {
      await this.couponHelperService.markCouponAsUsed(
        couponDetails.CouponId,
        userId,
      );
    }
    await this.productHelperService.updateProductStats(validatedItems);

    await this.orderEmailService.sendOrderEmail(
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
