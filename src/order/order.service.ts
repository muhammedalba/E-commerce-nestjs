import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UpdateOrderDto } from './shared/dto/update-order.dto';
import { Model, Types, Connection } from 'mongoose';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Order } from './shared/schemas/Order.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { OrderHelperService } from './shared/order-helper/order-helper.service';
import { OrderEmailService } from './shared/order-helper/order-email.service';
import { CouponHelperService } from '../coupons/shared/coupon.helper';
import { ProductHelperService } from './shared/order-helper/product.helper';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { OrdersStatisticsService } from './shared/order-helper/order-statistics.service';
import { User } from 'src/auth/shared/schema/user.schema';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/shared/schema/audit-log.schema';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private readonly OrderModel: Model<Order>,
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    private readonly i18n: CustomI18nService,
    private readonly fileUploadService: FileUploadService,
    private readonly orderHelperService: OrderHelperService,
    private readonly orderEmailService: OrderEmailService,
    private readonly productHelperService: ProductHelperService,
    private readonly couponHelperService: CouponHelperService,
    private readonly ordersStatisticsService: OrdersStatisticsService,
    private readonly auditService: AuditService,
    @InjectConnection() private readonly connection: Connection,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  private readonly logger = new Logger(OrderService.name);

  async OrdersStatistics(startDate?: string, endDate?: string) {
    return await this.ordersStatisticsService.OrdersStatistics(
      startDate,
      endDate,
    );
  }

  async findAll(user: JwtPayload, queryString: QueryString) {
    queryString.fields =
      'totalPrice totalQuantity grandTotal couponCode discountAmount paymentStatus isCheckedOut status paymentMethodId shippingAmount taxAmount paymentFees ';
    if (user.role.toLocaleLowerCase() !== 'admin') {
      queryString = { ...queryString, user: user.user_id };
    }
    const total = await this.OrderModel.countDocuments();
    const features = new ApiFeatures(this.OrderModel.find(), queryString)
      .filter()
      .search('orders')
      .sort()
      .limitFields()
      .paginate(total);

    const data = await features.getQuery().lean().exec();
    if (!data) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }
    return {
      status: 'success',
      results: data.length,
      pagination: features.getPagination(),
      data,
    };
  }

  async findOne(idParamDto: string) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idParamDto);
    if (!isObjectId) {
      throw new BadRequestException('Invalid order ID');
    }
    const order = await this.OrderModel.findById(idParamDto)
      .populate({
        path: 'user',
        select: 'name email role',
      })
      .lean()
      .exec();
    if (!order) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }
    return {
      status: 'success',
      message: this.i18n.translate('success.found_SUCCESS'),
      data: order,
    };
  }

  async update(
    idParamDto: IdParamDto,
    updateOrderDto: UpdateOrderDto,
    files: {
      transferReceiptImg: MulterFileType;
      DeliveryReceiptImage: MulterFileType;
      InvoicePdf: MulterFileType;
    },
  ) {
    // let newPath: string | undefined;
    // 1) check id is valid
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idParamDto.id);
    if (!isObjectId) {
      throw new BadRequestException('Invalid order ID');
    }
    const order = await this.OrderModel.findById(idParamDto.id).select(
      ' InvoicePdf DeliveryReceiptImage ',
    );
    if (!order) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }
    // 2) if file is exits
    if (files.InvoicePdf) {
      const newPdfPath = await this.fileUploadService.updateFile(
        files.InvoicePdf[0] as MulterFileType,
        'orders',
        order,
        order.InvoicePdf,
      );
      updateOrderDto.InvoicePdf = newPdfPath;
    }

    const updatedData = await this.OrderModel.findByIdAndUpdate(
      { _id: idParamDto.id },
      { $set: updateOrderDto },
      { new: true, runValidators: true },
    );

    if (
      updatedData &&
      (updateOrderDto.status === 'completed' ||
        updateOrderDto.status === 'cancelled')
    ) {
      const orderUserIdStr = updatedData.user.toString();
      this.eventEmitter.emit(`user.notification.${orderUserIdStr}`, {
        userId: orderUserIdStr,
        action:
          updateOrderDto.status === 'completed'
            ? 'ORDER_DELIVERED'
            : 'ORDER_CANCELED',
        message:
          updateOrderDto.status === 'completed'
            ? this.i18n.translateAll('notification.ORDER_DELIVERED')
            : this.i18n.translateAll('notification.ORDER_CANCELED'),
        payload: { orderId: updatedData._id },
      });
    }

    return {
      status: 'success',
      data: updatedData,
    };
  }

  async remove(idParamDto: IdParamDto) {
    // 1) : Validate ID format
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idParamDto.id);
    if (!isObjectId) {
      throw new BadRequestException('Invalid order ID');
    }

    // 2) Retrieve and delete order
    const data = await this.OrderModel.findOneAndDelete({ _id: idParamDto.id })
      .select('transferReceiptImg InvoicePdf DeliveryReceiptImage')
      .lean();

    if (!data) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    // 4) : Delete associated files if any
    const paths = [
      data.InvoicePdf,
      data.transferReceiptImg,
      data.DeliveryReceiptImage,
    ].filter((p): p is string => typeof p === 'string');

    if (paths.length) {
      try {
        await this.fileUploadService.deleteFiles(paths);
      } catch (err) {
        this.logger.warn?.(err);
      }
    }
  }

  /* ================================================ */
  /*  CREATE PENDING ORDER - Event Driven Logic       */
  /* ================================================ */
  @OnEvent('checkout.placeOrderCommand')
  async handlePlaceOrderCommand(orderPayload: {
    user: string;
    items: Record<string, unknown>[];
    shippingAddress: Record<string, unknown>;
    shippingProviderId: string;
    shippingRateId: string;
    paymentMethodId?: string;
    shippingAmount: number;
    taxAmount: number;
    paymentFees: number;
    totalPrice: number;
    discountAmount: number;
    grandTotal: number;
    currency: string;
    notes?: string;
    transferReceiptImg?: string;
    userEmail?: string;
    [key: string]: unknown;
  }) {
    try {
      // 1) Create Order Document
      const newOrder = new this.OrderModel({
        user: orderPayload.user,
        items: orderPayload.items,
        shippingAddress: orderPayload.shippingAddress,

        shippingProviderId: new Types.ObjectId(orderPayload.shippingProviderId),
        shippingRateId: new Types.ObjectId(orderPayload.shippingRateId),
        // paymentMethodId may be a real ObjectId OR a gateway code string (stripe/paypal/cod/banktransfer)
        // Only wrap in ObjectId when it looks like a 24-char hex string
        ...(orderPayload.paymentMethodId
          ? /^[a-f\d]{24}$/i.test(String(orderPayload.paymentMethodId))
            ? {
                paymentMethodId: new Types.ObjectId(
                  orderPayload.paymentMethodId,
                ),
              }
            : { paymentMethodCode: String(orderPayload.paymentMethodId) }
          : {}),

        shippingAmount: orderPayload.shippingAmount,
        taxAmount: orderPayload.taxAmount,
        paymentFees: orderPayload.paymentFees,
        totalPrice: orderPayload.totalPrice,
        discountAmount: orderPayload.discountAmount,
        grandTotal: orderPayload.grandTotal,
        currency: orderPayload.currency,

        status: 'pending',
        paymentStatus: 'pending',
        isCheckedOut: true,
        checkedOutAt: new Date(),
        checkoutSummary: orderPayload,
        notes: orderPayload.notes,
        transferReceiptImg: orderPayload.transferReceiptImg,
      });

      const savedOrder = await newOrder.save();

      // 2) Audit Log
      await this.auditService.log({
        action: AuditAction.ORDER_PLACED,
        module: 'ORDER',
        userId: orderPayload.user,
        userEmail: orderPayload.userEmail,
        newData: savedOrder.toObject(),
        previousData: {},
      });

      // Return orderId back to the Orchestrator
      return {
        success: true,
        orderId: savedOrder._id.toString(),
      };
    } catch (err: any) {
      const error = err as Error;
      this.logger.error(
        `Order Placement Failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /* ================================================ */
  /*  SAGA: ORDER CREATED EVENT HANDLER               */
  /* ================================================ */
  @OnEvent('order.created', { async: true })
  async handleOrderCreatedEvent(payload: {
    orderId: string;
    userId: string;
    items: { productId: string; variantId: string; quantity: number }[];
    couponDetails?: { CouponId?: string; [key: string]: unknown };
  }) {
    try {
      // 1) Re-validate and map items to ValidatedItem type for helper services
      const { validatedItems } =
        await this.orderHelperService.validateOrderItems(payload.items);

      // 2) Decrement Stock
      await this.productHelperService.updateProductStats(validatedItems);

      // 3) Mark Coupon as used
      if (payload.couponDetails && payload.couponDetails.CouponId) {
        await this.couponHelperService.markCouponAsUsed(
          new Types.ObjectId(payload.couponDetails.CouponId),
          payload.userId,
        );
      }

      // 4) Update User order count
      await this.UserModel.findByIdAndUpdate(payload.userId, {
        $inc: { totalOrder: 1 },
      });

      // 5) Send Email
      const order = await this.OrderModel.findById(payload.orderId);
      const user = await this.UserModel.findById(payload.userId);
      if (order && user) {
        await this.orderEmailService.sendOrderEmail(
          order,
          validatedItems,
          user.email,
        );
      }
    } catch (err: any) {
      const error = err as Error;
      this.logger.error(
        `Saga 'order.created' Failed: ${error.message}`,
        error.stack,
      );
      // Trigger compensating event
      this.eventEmitter.emit('order.failed', {
        ...payload,
        reason: error.message,
      });
    }
  }
  /* ================================================ */
  /*  SAGA: MOYASAR ORDER CREATED EVENT HANDLER       */
  /* ================================================ */
  @OnEvent('order.moyasar_created', { async: true })
  async handleMoyasarOrderCreatedEvent(payload: {
    orderId: string;
    userId: string;
    items: { productId: string; variantId: string; quantity: number }[];
    couponDetails?: { CouponId?: string; [key: string]: unknown };
  }) {
    try {
      const { validatedItems } =
        await this.orderHelperService.validateOrderItems(payload.items);
      await this.productHelperService.reserveStock(validatedItems);

      if (payload.couponDetails && payload.couponDetails.CouponId) {
        await this.couponHelperService.markCouponAsUsed(
          new Types.ObjectId(payload.couponDetails.CouponId),
          payload.userId,
        );
      }

      await this.UserModel.findByIdAndUpdate(payload.userId, {
        $inc: { totalOrder: 1 },
      });
    } catch (err: any) {
      const error = err as Error;
      this.logger.error(
        `Saga 'order.moyasar_created' Failed: ${error.message}`,
        error.stack,
      );
      this.eventEmitter.emit('order.failed', {
        ...payload,
        reason: error.message,
      });
    }
  }

  /* ================================================ */
  /*  SAGA: PAYMENT SUCCEEDED                         */
  /* ================================================ */
  @OnEvent('payment.succeeded', { async: true })
  async handlePaymentSucceeded(payload: {
    orderId: string;
    transactionId: string;
    provider: string;
    amount: number;
  }) {
    this.logger.log(`Handling payment.succeeded for order ${payload.orderId}`);
    try {
      const order = await this.OrderModel.findByIdAndUpdate(
        payload.orderId,
        {
          status: 'processing',
          paymentStatus: 'paid',
          paidAt: new Date(),
        },
        { new: true },
      );
      if (order && order.paymentMethodCode === 'moyasar') {
        const { validatedItems } =
          await this.orderHelperService.validateOrderItems(
            order.items as unknown as {
              productId: string;
              variantId: string;
              quantity: number;
            }[],
          );
        await this.productHelperService.confirmReservation(validatedItems);
        const user = await this.UserModel.findById(order.user);
        if (user) {
          await this.orderEmailService.sendOrderEmail(
            order,
            validatedItems,
            user.email,
          );
        }
      }
    } catch (err: any) {
      const error = err as Error;
      this.logger.error(
        `payment.succeeded failed for order ${payload.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /* ================================================ */
  /*  SAGA: PAYMENT FAILED                            */
  /* ================================================ */
  @OnEvent('payment.failed', { async: true })
  async handlePaymentFailed(payload: { orderId: string; reason: string }) {
    this.logger.log(`Handling payment.failed for order ${payload.orderId}`);
    try {
      const order = await this.OrderModel.findByIdAndUpdate(
        payload.orderId,
        { paymentStatus: 'failed' },
        { new: true },
      );
      if (order && order.paymentMethodCode === 'moyasar') {
        const { validatedItems } =
          await this.orderHelperService.validateOrderItems(
            order.items as unknown as {
              productId: string;
              variantId: string;
              quantity: number;
            }[],
          );
        await this.productHelperService.releaseReservation(validatedItems);
      }
    } catch (err: any) {
      const error = err as Error;
      this.logger.error(
        `payment.failed handler failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /* ================================================ */
  /*  SAGA: PAYMENT EXPIRED                           */
  /* ================================================ */
  @OnEvent('payment.expired', { async: true })
  async handlePaymentExpired(payload: { orderId: string }) {
    this.logger.log(`Handling payment.expired for order ${payload.orderId}`);
    try {
      const order = await this.OrderModel.findByIdAndUpdate(
        payload.orderId,
        { status: 'expired', paymentStatus: 'failed' },
        { new: true },
      );
      if (order && order.paymentMethodCode === 'moyasar') {
        const { validatedItems } =
          await this.orderHelperService.validateOrderItems(
            order.items as unknown as {
              productId: string;
              variantId: string;
              quantity: number;
            }[],
          );
        await this.productHelperService.releaseReservation(validatedItems);
      }
    } catch (err: any) {
      const error = err as Error;
      this.logger.error(
        `payment.expired handler failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /* ================================================ */
  /*  SAGA: COMPENSATING EVENT (ORDER FAILED)         */
  /* ================================================ */
  @OnEvent('order.failed', { async: true })
  async handleOrderFailedEvent(payload: {
    orderId: string;
    userId: string;
    items: { productId: string; variantId: string; quantity: number }[];
    couponDetails?: { CouponId?: string; [key: string]: unknown };
    reason?: string;
  }) {
    this.logger.warn(
      `Compensating Actions for failed order ${payload.orderId}: ${payload.reason}`,
    );

    try {
      // 1) Mark order as cancelled
      await this.OrderModel.findByIdAndUpdate(payload.orderId, {
        status: 'cancelled',
        notes: `Cancelled due to system failure: ${payload.reason}`,
      });

      // 2) Revert Stock
      // Since it's a compensation, we increment stock instead of decrement
      // TODO: Implement revertProductStats in productHelperService and call it here.
      // const { validatedItems } = await this.orderHelperService.validateOrderItems(payload.items);

      // 3) Revert Coupon (not implemented in CouponHelperService yet, but we'd call it if it existed)
      // e.g. await this.couponHelperService.revertCouponUsage(payload.couponDetails.CouponId, payload.userId);
    } catch (err: any) {
      const error = err as Error;
      // Very bad if compensating event fails. Should be logged to DLQ or manually inspected.
      this.logger.error(
        `CRITICAL: Compensating Action for 'order.failed' crashed: ${error.message}`,
        error.stack,
      );
    }
  }
}
