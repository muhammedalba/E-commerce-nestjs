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
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { withBaseUrl } from 'src/shared/utils/with-base-url.util';
// 1. تعريف الأنواع بشكل دقيق وصريح
interface UserPopulated {
  avatar?: string;
  [key: string]: unknown;
}

interface ShippingProviderPopulated {
  logo?: string;
  [key: string]: unknown;
}

interface ProductPopulated {
  imageCover?: string;
  images?: string[];
  [key: string]: unknown;
}

interface OrderItemPopulated {
  productId?: ProductPopulated;
  [key: string]: unknown;
}

export interface PopulatedOrderData {
  user?: UserPopulated;
  transferReceiptImg?: string;
  InvoicePdf?: string;
  DeliveryReceiptImage?: string;
  shippingProviderId?: ShippingProviderPopulated;
  items?: OrderItemPopulated[];
  [key: string]: unknown;
}
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

  /**
   * يبني كائن الـ timestamps المناسب بناءً على الحالة الجديدة.
   * يجب استدعاؤه مع كل تعديل على status أو paymentStatus لضمان الاتساق.
   */
  private buildStatusTimestamps(
    status?: string,
    paymentStatus?: string,
  ): Record<string, Date> {
    const now = new Date();
    const timestamps: Record<string, Date> = {};

    if (status) {
      switch (status) {
        case 'processing':
          timestamps.processingAt = now;
          break;
        case 'completed':
          timestamps.completedAt = now;
          break;
        case 'cancelled':
        case 'expired':
          timestamps.cancelledAt = now;
          break;
        case 'shipped':
          timestamps.shippedAt = now;
          break;
        case 'delivered':
          timestamps.deliveredAt = now;
          break;
      }
    }

    if (paymentStatus === 'PAID') {
      timestamps.paidAt = now;
    }

    return timestamps;
  }
  // =============================================================
  // =============================================================
  // =============================================================
  async OrdersStatistics(startDate?: string, endDate?: string) {
    return await this.ordersStatisticsService.OrdersStatistics(
      startDate,
      endDate,
    );
  }
  // =============================================================
  // =============================================================
  // =============================================================
  async findAll(user: JwtPayload, queryString: QueryString) {
    // queryString.fields =
    // 'totalPrice totalQuantity grandTotal couponCode discountAmount paymentStatus isCheckedOut status paymentMethodId shippingAmount taxAmount paymentFees user createdAt currency';
    if (
      user.permissions &&
      !user.permissions.includes(Permissions.VIEW_ORDERS)
    ) {
      queryString = { ...queryString, user: user.user_id };
    }

    const filterQuery: {
      createdAt?: { $gte?: Date; $lte?: Date };
      $or?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    } = {};

    if (queryString.startDate || queryString.endDate) {
      filterQuery.createdAt = {};
      if (queryString.startDate) {
        filterQuery.createdAt.$gte = new Date(queryString.startDate as string);
      }
      if (queryString.endDate) {
        const end = new Date(queryString.endDate as string);
        end.setHours(23, 59, 59, 999);
        filterQuery.createdAt.$lte = end;
      }
    }

    if (queryString.paymentMethod) {
      filterQuery.$or = [
        { paymentMethod: queryString.paymentMethod },
        { paymentMethodCode: queryString.paymentMethod },
      ];
      delete queryString.paymentMethod;
    }

    if (queryString.paymentStatus) {
      const statusVal = queryString.paymentStatus as string;
      filterQuery.paymentStatus = {
        $in: [statusVal.toLowerCase(), statusVal.toUpperCase()],
      };
      delete queryString.paymentStatus;
    }

    if (queryString.status) {
      const statusVal = queryString.status as string;
      filterQuery.status = {
        $in: [statusVal.toLowerCase(), statusVal.toUpperCase()],
      };
      delete queryString.status;
    }

    const total = await this.OrderModel.countDocuments(filterQuery);
    const features = new ApiFeatures(
      this.OrderModel.find(filterQuery),
      queryString,
    )
      .filter()
      .search(MODEL_NAMES.ORDER)
      .sort()
      .limitFields()
      .paginate(total);

    const data = await features
      .getQuery()
      .populate({ path: 'user', select: 'name email avatar' })
      .populate({ path: 'shippingAddress.country', select: 'name' })
      .populate({ path: 'shippingAddress.city', select: 'name' })
      .populate({ path: 'shippingProviderId', select: 'name code logo' })
      .populate({ path: 'shippingRateId', select: 'estimatedDays basePrice' })
      .populate({ path: 'items.productId', select: 'title slug imageCover' })
      .populate({
        path: 'items.variantId',
        select: 'sku price priceAfterDiscount label attributes',
      })
      .lean()
      .exec();
    if (!data) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }
    // add url to user avatar & product images
    data.forEach((item) => {
      const typedItem = item as unknown as {
        user?: { avatar?: string };
        items?: Array<{
          productId?: {
            imageCover?: string;
            images?: string[];
          };
        }>;
      };

      if (
        typedItem.user &&
        typedItem.user.avatar &&
        !typedItem.user.avatar.startsWith('http')
      ) {
        typedItem.user.avatar = `${process.env.BASE_URL}${typedItem.user.avatar}`;
      }

      if (typedItem.items) {
        typedItem.items.forEach((orderItem) => {
          if (orderItem.productId) {
            if (
              orderItem.productId.imageCover &&
              !orderItem.productId.imageCover.startsWith('http')
            ) {
              orderItem.productId.imageCover = `${process.env.BASE_URL}${orderItem.productId.imageCover}`;
            }
            if (orderItem.productId.images) {
              orderItem.productId.images = orderItem.productId.images.map(
                (img) =>
                  img && !img.startsWith('http')
                    ? `${process.env.BASE_URL}${img}`
                    : img,
              );
            }
          }
        });
      }
    });
    return {
      status: 'success',
      results: data.length,
      pagination: features.getPagination(),
      data,
    };
  }
  // =============================================================
  // =============================================================
  // =============================================================
  // async findOne(idParamDto: string) {
  //   // 1. استخدام التحقق المعياري لـ Mongo ObjectId
  //   if (!Types.ObjectId.isValid(idParamDto)) {
  //     throw new BadRequestException('Invalid order ID');
  //   }

  //   // 2. تنفيذ الاستعلام مع lean ووضع images في الـ select
  //   const order = await this.OrderModel.findById(idParamDto)
  //     .populate({
  //       path: 'user',
  //       select: 'name email role avatar phone createdAt',
  //     })
  //     .populate({
  //       path: 'items.productId',
  //       select: 'title imageCover slug images',
  //     })
  //     .populate({
  //       path: 'items.variantId',
  //       select: 'sku price priceAfterDiscount label attributes',
  //     })
  //     .populate({
  //       path: 'shippingAddress.country',
  //       select: 'name',
  //     })
  //     .populate({
  //       path: 'shippingAddress.city',
  //       select: 'name',
  //     })
  //     .populate({
  //       path: 'couponId',
  //       select: 'name type usageCount expires discount',
  //     })
  //     .populate({
  //       path: 'shippingProviderId',
  //       select: 'name code logo trackingUrl',
  //     })
  //     .populate({
  //       path: 'shippingRateId',
  //       select: 'estimatedDays basePrice baseWeight additionalKgPrice',
  //     })
  //     .lean()
  //     .exec();

  //   if (!order) {
  //     throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
  //   }

  //   // 3. تنسيق روابط الصور بشكل نظيف ومباشر باستخدام withBaseUrl
  //   const orderObj = order as unknown as {
  //     user?: { avatar?: string };
  //     shippingProviderId?: { logo?: string };
  //     transferReceiptImg?: string;
  //     items?: Array<{
  //       productId?: {
  //         imageCover?: string;
  //         images?: string[];
  //       };
  //     }>;
  //   };

  //   if (orderObj.user?.avatar) {
  //     orderObj.user.avatar = withBaseUrl(orderObj.user.avatar) as string;
  //   }

  //   if (orderObj.transferReceiptImg) {
  //     orderObj.transferReceiptImg = withBaseUrl(
  //       orderObj.transferReceiptImg,
  //     ) as string;
  //   }

  //   if (orderObj.shippingProviderId?.logo) {
  //     orderObj.shippingProviderId.logo = withBaseUrl(
  //       orderObj.shippingProviderId.logo,
  //     ) as string;
  //   }

  //   if (Array.isArray(orderObj.items)) {
  //     orderObj.items.forEach((item) => {
  //       if (item.productId) {
  //         if (item.productId.imageCover) {
  //           item.productId.imageCover = withBaseUrl(
  //             item.productId.imageCover,
  //           ) as string;
  //         }
  //         if (item.productId.images) {
  //           item.productId.images = item.productId.images
  //             .map((img) => withBaseUrl(img))
  //             .filter((img): img is string => img != null);
  //         }
  //       }
  //     });
  //   }

  //   return {
  //     status: 'success',
  //     message: this.i18n.translate('success.found_SUCCESS'),
  //     data: order,
  //   };
  // }

  // 2. الدالة المُحسنة
  async findOne(idParamDto: string) {
    if (!Types.ObjectId.isValid(idParamDto)) {
      throw new BadRequestException('Invalid order ID');
    }

    // استخدام (as unknown as PopulatedOrderData) لقطع سلسلة any القادمة من Mongoose نهائياً
    const order = (await this.OrderModel.findById(idParamDto)
      .populate([
        { path: 'user', select: 'name email role avatar phone createdAt' },
        { path: 'items.productId', select: 'title imageCover slug images' },
        {
          path: 'items.variantId',
          select: 'sku price priceAfterDiscount label attributes',
        },
        { path: 'shippingAddress.country', select: 'name' },
        { path: 'shippingAddress.city', select: 'name' },
        { path: 'couponId', select: 'name type usageCount expires discount' },
        { path: 'shippingProviderId', select: 'name code logo trackingUrl' },
        {
          path: 'shippingRateId',
          select: 'estimatedDays basePrice baseWeight additionalKgPrice',
        },
      ])
      .lean()
      .exec()) as unknown as PopulatedOrderData | null;

    if (!order) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    // الآن order.user ليس any بل UserPopulated | undefined، مما يرضي ESLint تماماً
    if (order.user?.avatar) {
      order.user.avatar = String(withBaseUrl(order.user.avatar));
    }

    if (order.transferReceiptImg) {
      order.transferReceiptImg = String(withBaseUrl(order.transferReceiptImg));
    }

    if (order.InvoicePdf) {
      order.InvoicePdf = String(withBaseUrl(order.InvoicePdf));
    }

    if (order.DeliveryReceiptImage) {
      order.DeliveryReceiptImage = String(
        withBaseUrl(order.DeliveryReceiptImage),
      );
    }

    if (order.shippingProviderId?.logo) {
      order.shippingProviderId.logo = String(
        withBaseUrl(order.shippingProviderId.logo),
      );
    }

    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        const product = item.productId;
        if (!product) continue;

        if (product.imageCover) {
          product.imageCover = String(withBaseUrl(product.imageCover));
        }

        if (Array.isArray(product.images)) {
          product.images = product.images
            .map((img) => String(withBaseUrl(img)))
            .filter((img): img is string => Boolean(img));
        }
      }
    }

    return {
      status: 'success',
      message: String(this.i18n.translate('success.found_SUCCESS')),
      data: order,
    };
  }
  // =============================================================
  // =============================================================
  // =============================================================
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
    // 2) if file is exits (This feature has not been implemented yet; the invoice cannot be downloaded. )
    if (files.InvoicePdf) {
      const newPdfPath = await this.fileUploadService.updateFile(
        files.InvoicePdf[0] as MulterFileType,
        'orders',
        order,
        order.InvoicePdf,
      );
      updateOrderDto.InvoicePdf = newPdfPath;
    }

    if (files.DeliveryReceiptImage) {
      const newReceiptImagePath = await this.fileUploadService.updateFile(
        files.DeliveryReceiptImage[0] as MulterFileType,
        'orders',
        order,
        order.DeliveryReceiptImage,
      );
      updateOrderDto.DeliveryReceiptImage = newReceiptImagePath;
    }

    if (
      updateOrderDto.DeliveryReceiptImage === '' ||
      updateOrderDto.DeliveryReceiptImage === null
    ) {
      if (order.DeliveryReceiptImage) {
        try {
          await this.fileUploadService.deleteFile(order.DeliveryReceiptImage);
        } catch (err) {
          this.logger.warn?.(
            `Failed to delete DeliveryReceiptImage: ${String(err)}`,
          );
        }
      }
    }

    if (
      updateOrderDto.InvoicePdf === '' ||
      updateOrderDto.InvoicePdf === null
    ) {
      if (order.InvoicePdf) {
        try {
          await this.fileUploadService.deleteFile(order.InvoicePdf);
        } catch (err) {
          this.logger.warn?.(`Failed to delete InvoicePdf: ${String(err)}`);
        }
      }
    }

    // حساب timestamps المناسبة بناءً على الحالة الجديدة
    const statusTimestamps = this.buildStatusTimestamps(
      updateOrderDto.status as string | undefined,
      updateOrderDto.paymentStatus as string | undefined,
    );

    const updatedData = await this.OrderModel.findByIdAndUpdate(
      { _id: idParamDto.id },
      { $set: { ...updateOrderDto, ...statusTimestamps } },
      { new: true, runValidators: true },
    );

    if (
      updatedData &&
      ((updateOrderDto.status as string) === 'completed' ||
        (updateOrderDto.status as string) === 'cancelled')
    ) {
      const orderUserIdStr = updatedData.user.toString();
      this.eventEmitter.emit(`user.notification.${orderUserIdStr}`, {
        userId: orderUserIdStr,
        action:
          (updateOrderDto.status as string) === 'completed'
            ? 'ORDER_DELIVERED'
            : 'ORDER_CANCELED',
        message:
          (updateOrderDto.status as string) === 'completed'
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
  // =============================================================
  // =============================================================
  // =============================================================
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
    paymentMethodCode?: string;
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
      // 0) Validate items before creating the order
      const { validatedItems, updatedProducts, unAvailableProducts } =
        await this.orderHelperService.validateOrderItems(
          orderPayload.items as unknown as {
            productId: string;
            variantId: string;
            quantity: number;
          }[],
        );

      if (
        validatedItems.length === 0 ||
        updatedProducts.length > 0 ||
        unAvailableProducts.length > 0
      ) {
        throw new BadRequestException(
          'Some items in your cart are no longer available or out of stock. Please review your cart.',
        );
      }

      // 1) Create Order Document
      const newOrder = new this.OrderModel({
        user: orderPayload.user,
        items: orderPayload.items,
        shippingAddress: {
          ...orderPayload.shippingAddress,
          country: new Types.ObjectId(
            orderPayload.shippingAddress.country as string,
          ),
          city: new Types.ObjectId(orderPayload.shippingAddress.city as string),
        },

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

        ...(orderPayload.paymentMethodCode
          ? { paymentMethodCode: orderPayload.paymentMethodCode }
          : {}),

        shippingAmount: orderPayload.shippingAmount,
        taxAmount: orderPayload.taxAmount,
        paymentFees: orderPayload.paymentFees,
        totalPrice: orderPayload.totalPrice,
        discountAmount: orderPayload.discountAmount,
        couponId: orderPayload.couponId
          ? new Types.ObjectId(orderPayload.couponId as string)
          : undefined,
        grandTotal: orderPayload.grandTotal,
        currency: orderPayload.currency,
        totalQuantity: Array.isArray(orderPayload.items)
          ? (orderPayload.items as { quantity: number | string }[]).reduce(
              (sum: number, item: { quantity: number | string }) =>
                sum + (Number(item.quantity) || 0),
              0,
            )
          : 0,

        status: 'pending',
        paymentStatus: 'pending',
        checkedOutAt: new Date(),
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
      return {
        success: false,
        error: error.message,
      };
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
    couponDetails?: { couponId?: string; [key: string]: unknown };
  }) {
    try {
      // 1) Re-validate and map items to ValidatedItem type for helper services
      const { validatedItems } =
        await this.orderHelperService.validateOrderItems(payload.items);

      // 2) Decrement Stock
      await this.productHelperService.updateProductStats(validatedItems);

      // 3) Mark Coupon as used
      if (payload.couponDetails && payload.couponDetails.couponId) {
        await this.couponHelperService.markCouponAsUsed(
          new Types.ObjectId(payload.couponDetails.couponId),
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
    couponDetails?: { couponId?: string; [key: string]: unknown };
  }) {
    try {
      const { validatedItems } =
        await this.orderHelperService.validateOrderItems(payload.items);
      await this.productHelperService.reserveStock(validatedItems);

      if (payload.couponDetails && payload.couponDetails.couponId) {
        await this.couponHelperService.markCouponAsUsed(
          new Types.ObjectId(payload.couponDetails.couponId),
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
      const timestamps = this.buildStatusTimestamps('processing', 'PAID');
      const order = await this.OrderModel.findByIdAndUpdate(
        payload.orderId,
        {
          status: 'processing',
          paymentStatus: 'PAID',
          ...timestamps,
        },
        { new: true },
      );
      if (
        order &&
        (order.paymentMethodCode === 'moyasar' ||
          payload.provider === 'moyasar')
      ) {
        console.log('order items ', order?.items);

        const { validatedItems } =
          await this.orderHelperService.validateOrderItems(
            order.items as unknown as {
              productId: string;
              variantId: string;
              quantity: number;
            }[],
          );
        console.log('validatedItems after orderHelperService ', validatedItems);
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
      const timestamps = this.buildStatusTimestamps(undefined, 'FAILED');
      const order = await this.OrderModel.findByIdAndUpdate(
        payload.orderId,
        { paymentStatus: 'FAILED', ...timestamps },
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
      const timestamps = this.buildStatusTimestamps('expired', 'FAILED');
      const order = await this.OrderModel.findByIdAndUpdate(
        payload.orderId,
        { status: 'expired', paymentStatus: 'FAILED', ...timestamps },
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
