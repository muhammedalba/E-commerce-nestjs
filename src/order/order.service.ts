import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UpdateOrderDto } from './shared/dto/update-order.dto';
import { HydratedDocument, Model, Types, Connection } from 'mongoose';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Order } from './shared/schemas/Order.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import {
  OrderHelperService,
  OrderItemSnapshot,
} from './shared/order-helper/order-helper.service';
import { OrderEmailService } from './shared/order-helper/order-email.service';
import { CouponHelperService } from '../coupons/shared/coupon.helper';
import {
  ProductHelperService,
  StockShortageError,
} from './shared/order-helper/product.helper';
import { withTransactionRetry } from 'src/shared/utils/database.utils';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { OrdersStatisticsService } from './shared/order-helper/order-statistics.service';
import { User } from 'src/auth/shared/schema/user.schema';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/shared/schema/audit-log.schema';
import { AUDIT_MODULES } from '../audit/shared/audit.constants';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CacheInvalidationService } from 'src/shared/services/cache-invalidation.service';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { withBaseUrl } from 'src/shared/utils/with-base-url.util';
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import { OrderStatus } from './shared/enums/order-status.enum';
import { orderStatusNotificationAction } from './shared/utils/order-status-notification';
import { PaymentStatus } from 'src/payments/shared/enums/payment-status.enum';
import { PaymentRefundedEvent } from 'src/payments/shared/types/payment-events';
import { InvoiceService } from 'src/invoice/invoice.service';
import { OrderCreditNoteService } from './shared/order-helper/order-credit-note.service';
import { OrderReturnRequestService } from './shared/order-helper/order-return-request.service';

type OrderLine = { productId: string; variantId: string; quantity: number };

/**
 * What an order saga has already applied, so `order.failed` undoes exactly
 * that: a step that never ran (e.g. validation failed first) is not reverted.
 */
interface OrderSagaUndo {
  /** Lines whose stock was deducted (COD). */
  deducted?: OrderLine[];
  /** Lines whose stock was reserved (Moyasar). */
  reserved?: OrderLine[];
  /** Coupon marked as used for the order's user. */
  couponId?: string;
  /** The user's `totalOrder` was incremented. */
  countedOrder?: boolean;
}

/** Final statuses whose stock has been given back to inventory. */
const CLOSED_ORDER_STATUSES: string[] = [
  OrderStatus.CANCELLED,
  OrderStatus.EXPIRED,
];
// 1. تعريف الأنواع بشكل دقيق وصريح
export interface UserPopulated {
  avatar?: FileAsset;
  [key: string]: unknown;
}

export interface ShippingProviderPopulated {
  logo?: FileAsset;
  [key: string]: unknown;
}

interface ProductPopulated {
  imageCover?: FileAsset;
  images?: FileAsset[];
  [key: string]: unknown;
}

export interface OrderItemPopulated {
  productId?: ProductPopulated;
  image?: FileAsset | string;
  [key: string]: unknown;
}

export interface PopulatedOrderData {
  user?: UserPopulated;
  transferReceiptImg?: FileAsset;
  InvoicePdf?: FileAsset;
  DeliveryReceiptImage?: FileAsset;
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
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly invoiceService: InvoiceService,
    private readonly orderCreditNoteService: OrderCreditNoteService,
    private readonly orderReturnRequestService: OrderReturnRequestService,
  ) {}
  private readonly logger = new Logger(OrderService.name);

  /**
   * Expires the cached /order responses (admin list + statistics + dashboard).
   * The saga handlers below change orders outside any order HTTP request
   * (payment webhook, payment scheduler, refunds), where @ClearCache can't run.
   */
  private async invalidateOrderCache(): Promise<void> {
    try {
      await this.cacheInvalidation.clearResources(['order']);
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to clear order cache: ${(err as Error).message}`,
      );
    }
  }

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

    // Built here instead of ApiFeatures.search(): its $or would replace the
    // paymentMethod $or above, and customer name/email need a user lookup.
    const keywords = queryString.keywords?.trim();
    delete queryString.keywords;
    if (keywords) {
      filterQuery.$and = [await this.buildOrderSearchFilter(keywords)];
    }

    const features = new ApiFeatures(
      this.OrderModel.find(filterQuery),
      queryString,
    )
      .filter()
      .sort()
      .limitFields();
    // Count after filter(), so the total includes the `user` restriction and
    // the other query-string filters, like the page itself.
    const total = await this.OrderModel.countDocuments(
      features.getQuery().getFilter(),
    );
    features.paginate(total);

    const data = await features
      .getQuery()
      .populate({ path: 'user', select: 'name email avatar' })
      .populate({ path: 'shippingAddress.country', select: 'name' })
      .populate({ path: 'shippingAddress.region', select: 'name' })
      .populate({ path: 'shippingAddress.city', select: 'name' })
      .populate({ path: 'shippingProviderId', select: 'name code logo' })
      .populate({ path: 'shippingRateId', select: 'estimatedDays basePrice' })
      .populate({ path: 'items.productId', select: 'title slug imageCover' })
      .populate({
        path: 'items.variantId',
        select:
          'sku price priceAfterDiscount label attributes components shippingProfile',
      })
      .lean()
      .exec();
    if (!data) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }
    // add url to user avatar & product images
    data.forEach((item) => {
      const typedItem = item as unknown as {
        user?: { avatar?: { url: string } };
        items?: Array<{
          productId?: {
            imageCover?: { url: string };
            images?: string[];
          };
          image?: FileAsset | string;
        }>;
      };

      if (typedItem.user?.avatar) {
        // دعم الحالة القديمة: avatar محفوظ كنص مباشر في DB
        if (typeof (typedItem.user.avatar as unknown) === 'string') {
          const avatarUrl = typedItem.user.avatar as unknown as string;
          typedItem.user.avatar = {
            url: String(withBaseUrl(avatarUrl)),
          };
        } else if (typedItem.user.avatar.url) {
          typedItem.user.avatar.url = String(
            withBaseUrl(typedItem.user.avatar.url),
          );
        }
      }

      if (typedItem.items) {
        typedItem.items.forEach((orderItem) => {
          if (orderItem.image) orderItem.image = withBaseUrl(orderItem.image);
          if (orderItem.productId) {
            if (orderItem.productId.imageCover?.url) {
              orderItem.productId.imageCover.url = String(
                withBaseUrl(orderItem.productId.imageCover.url),
              );
            }
            if (orderItem.productId.images) {
              orderItem.productId.images = withBaseUrl(
                orderItem.productId.images,
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

  /**
   * Every word of the search must match one of: the recipient's first name,
   * last name or phone, or the account holder's name/email. Splitting into
   * words lets a full name ("Sara Ahmed") match firstName + lastName, which
   * are stored apart. Orders store only the user's id, so matching users are
   * looked up first and their orders matched by id.
   * A number also matches the invoice number exactly.
   */
  private async buildOrderSearchFilter(keywords: string) {
    // Each word costs one users query: cap them so a long input stays cheap.
    const words = keywords.split(/\s+/).filter(Boolean).slice(0, 5);

    const wordFilters = await Promise.all(
      words.map(async (word) => {
        const regex = {
          $regex: word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          $options: 'i',
        };
        const users = await this.UserModel.find({
          $or: [{ name: regex }, { email: regex }],
        })
          .select('_id')
          .lean();

        return {
          $or: [
            { 'shippingAddress.firstName': regex },
            { 'shippingAddress.lastName': regex },
            { 'shippingAddress.phone': regex },
            ...(users.length
              ? [{ user: { $in: users.map((u) => u._id) } }]
              : []),
          ],
        };
      }),
    );

    const conditions: Record<string, unknown>[] = [{ $and: wordFilters }];
    if (/^\d+$/.test(keywords)) {
      conditions.push({ invoiceNumber: Number(keywords) });
    }
    return { $or: conditions };
  }
  // =============================================================
  // =============================================================
  // =============================================================

  /**
   * Returns only the current user's requests, with a limited set of fields (a whitelist)
   * suitable for the client-facing interface. Unlike `findAll` (intended for the
   * admin dashboard), this method does not expose any internal or administrative
   * fields (such as `notes` or `isDeleted`), nor does it allow for any general
   * filtering beyond sorting and pagination.
   */
  async findMyOrders(userId: string, queryString: QueryString) {
    const filterQuery = { user: new Types.ObjectId(userId) };
    const activeStatuses = [
      OrderStatus.PENDING_PAYMENT,
      OrderStatus.PENDING,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
    ];

    // Both counts are cheap, index-backed countDocuments queries (no
    // population, no document fetching) — running them alongside the page
    // query lets the client show "active orders" without a second request
    // or scanning order documents on the frontend.
    const [total, activeCount] = await Promise.all([
      this.OrderModel.countDocuments(filterQuery),
      this.OrderModel.countDocuments({
        ...filterQuery,
        status: { $in: activeStatuses },
      }),
    ]);
    const features = new ApiFeatures(
      this.OrderModel.find(filterQuery),
      queryString,
    )
      .sort()
      .paginate(total);

    const data = await features
      .getQuery()
      .select(
        'items  invoiceNumber status paymentStatus grandTotal totalPrice totalQuantity currency ' +
          'discountAmount couponCode ' +
          'createdAt checkedOutAt processingAt shippedAt deliveredAt paidAt completedAt cancelledAt',
      )
      .populate({ path: 'items.productId', select: 'title slug imageCover' })
      .populate({
        path: 'items.variantId',
        select:
          'sku price priceAfterDiscount label attributes components shippingProfile',
      })
      .populate({ path: 'couponId', select: 'name type discount' })
      .lean()
      .exec();

    // add absolute url to product cover images (نفس نمط findAll)
    data.forEach((item) => {
      const typedItem = item as unknown as {
        items?: Array<{
          productId?: { imageCover?: { url: string } };
          image?: FileAsset | string;
        }>;
      };

      if (typedItem.items) {
        typedItem.items.forEach((orderItem) => {
          if (orderItem.image) orderItem.image = withBaseUrl(orderItem.image);
          if (orderItem.productId?.imageCover?.url) {
            orderItem.productId.imageCover.url = String(
              withBaseUrl(orderItem.productId.imageCover.url),
            );
          }
        });
      }
    });

    return {
      status: 'success',
      results: data.length,
      pagination: { ...features.getPagination(), activeCount },
      data,
    };
  }
  // =============================================================
  // =============================================================
  // =============================================================

  /**
   * Returns the details of a single order, exclusively for the current user.
   * Order ownership is enforced within the query itself (`user: userId`)
   * rather than through a post-fetch check. This prevents a client from
   * discovering the existence of another user's order by guessing its ID
   * (a `NOT_FOUND` response is returned regardless of whether the order
   * does not exist or belongs to a different user).
   * The returned fields are restricted (via a whitelist) and exclude
   * `notes`, `isDeleted`, or any other internal administrative fields.
   */
  async findMyOrder(userId: string, orderId: string) {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Invalid order ID');
    }

    const order = (await this.OrderModel.findOne({
      _id: orderId,
      user: new Types.ObjectId(userId),
    })
      .select(
        'items status paymentStatus paymentMethodCode  paymentMethod shippingMethod ' +
          'shippingAddress shippingProviderId shippingRateId shippingAmount taxAmount chargedTaxAmount ' +
          'productsAmountBeforeTax productsAmountAfterTax taxPercentage taxesIncluded applyTaxOnCharges ' +
          'paymentFees grandTotal totalPrice totalQuantity discountAmount currency ' +
          'refundedAmount refundedAt ' +
          'couponId couponCode transferReceiptImg InvoicePdf DeliveryReceiptImage ' +
          'deliveryReceiptNumber deliveryDate deliveryName invoiceNumber ' +
          'customerServiceContact DeliveryVerificationCode ' +
          'checkedOutAt processingAt shippedAt deliveredAt paidAt completedAt cancelledAt ' +
          'createdAt updatedAt',
      )
      .populate([
        { path: 'items.productId', select: 'title imageCover slug images' },
        {
          path: 'items.variantId',
          select:
            'sku price priceAfterDiscount label attributes components shippingProfile',
        },
        { path: 'shippingAddress.country', select: 'name' },
        { path: 'shippingAddress.region', select: 'name' },
        { path: 'shippingAddress.city', select: 'name' },
        { path: 'couponId', select: 'name type discount' },
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

    if (order.transferReceiptImg?.url) {
      order.transferReceiptImg.url = String(
        withBaseUrl(order.transferReceiptImg?.url),
      );
    }

    if (order.InvoicePdf?.url) {
      order.InvoicePdf.url = String(withBaseUrl(order.InvoicePdf.url));
    }

    if (order.DeliveryReceiptImage?.url) {
      order.DeliveryReceiptImage.url = String(
        withBaseUrl(order.DeliveryReceiptImage.url),
      );
    }

    if (order.shippingProviderId?.logo?.url) {
      order.shippingProviderId.logo.url = String(
        withBaseUrl(order.shippingProviderId.logo.url),
      );
    }

    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.image) item.image = withBaseUrl(item.image);

        const product = item.productId;
        if (!product) continue;

        if (product.imageCover?.url) {
          product.imageCover.url = String(withBaseUrl(product.imageCover.url));
        }

        if (Array.isArray(product.images)) {
          product.images = product.images.filter((img: FileAsset) =>
            Boolean(img.url),
          );
          for (const img of product.images) {
            img.url = String(withBaseUrl(img.url));
          }
        }
      }
    }

    return {
      status: 'success',
      message: String(this.i18n.translate('success.found_SUCCESS')),
      data: {
        ...order,
        creditNotes: await this.creditNotesFor(String(order._id), true),
        ...(await this.returnsFor(order, true)),
      },
    };
  }
  // =============================================================
  // =============================================================
  // =============================================================

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
          select:
            'sku price priceAfterDiscount label attributes components shippingProfile',
        },
        { path: 'shippingAddress.country', select: 'name' },
        { path: 'shippingAddress.city', select: 'name' },
        { path: 'shippingAddress.region', select: 'name' },
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
    if (order.user?.avatar) {
      if (typeof (order.user.avatar as unknown) === 'string') {
        const avatarUrl = order.user.avatar as unknown as string;
        order.user.avatar = {
          url: String(withBaseUrl(avatarUrl)),
          publicId: avatarUrl,
          provider: 'local',
        };
      } else if (order.user.avatar.url) {
        order.user.avatar.url = String(withBaseUrl(order.user.avatar.url));
      }
    }

    if (order.transferReceiptImg?.url) {
      order.transferReceiptImg.url = String(
        withBaseUrl(order.transferReceiptImg?.url),
      );
    }

    if (order.InvoicePdf?.url) {
      order.InvoicePdf.url = String(withBaseUrl(order.InvoicePdf.url));
    }

    if (order.DeliveryReceiptImage?.url) {
      order.DeliveryReceiptImage.url = String(
        withBaseUrl(order.DeliveryReceiptImage.url),
      );
    }

    if (order.shippingProviderId?.logo?.url) {
      order.shippingProviderId.logo.url = String(
        withBaseUrl(order.shippingProviderId.logo.url),
      );
    }

    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.image) item.image = withBaseUrl(item.image);

        const product = item.productId;
        if (!product) continue;

        if (product.imageCover?.url) {
          product.imageCover.url = String(withBaseUrl(product.imageCover.url));
        }

        if (Array.isArray(product.images)) {
          product.images = product.images.filter((img: FileAsset) =>
            Boolean(img.url),
          );
          for (const img of product.images) {
            img.url = String(withBaseUrl(img.url));
          }
        }
      }
    }

    return {
      status: 'success',
      message: String(this.i18n.translate('success.found_SUCCESS')),
      data: {
        ...order,
        creditNotes: await this.creditNotesFor(String(order._id), false),
        ...(await this.returnsFor(order, false)),
      },
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
      ' InvoicePdf DeliveryReceiptImage status paymentStatus ',
    );
    if (!order) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    // إعادة تفعيل طلب ملغي/منتهي: إنقاص المخزون من جديد (قبل رفع الملفات حتى لا تبقى ملفات يتيمة عند الرفض)
    const newStatus = updateOrderDto.status as string | undefined;
    if (newStatus && !CLOSED_ORDER_STATUSES.includes(newStatus)) {
      await this.deductReactivatedOrder(idParamDto.id, newStatus);
    }

    // 2) if file is exits (This feature has not been implemented yet; the invoice cannot be downloaded. )
    // An issued tax invoice's file is kept for the record: replacing or
    // removing it on the order only unlinks it
    const keepsIssuedInvoice = await this.invoiceService.isIssuedInvoiceFile(
      idParamDto.id,
      order.InvoicePdf,
    );
    if (files.InvoicePdf) {
      const uploaded = files.InvoicePdf[0] as MulterFileType;
      const newPdfPath = keepsIssuedInvoice
        ? await this.fileUploadService.saveFileToDisk(uploaded, Order.name)
        : await this.fileUploadService.updateFile(
            uploaded,
            Order.name,
            order.InvoicePdf,
          );
      updateOrderDto.InvoicePdf = newPdfPath;
    }

    if (files.DeliveryReceiptImage) {
      const newReceiptImagePath = await this.fileUploadService.updateFile(
        files.DeliveryReceiptImage[0] as MulterFileType,
        Order.name,
        order.DeliveryReceiptImage,
      );
      updateOrderDto.DeliveryReceiptImage = newReceiptImagePath;
    }

    // Only an explicit removal ('' or null, as OrderDeliveryCard sends) deletes
    // the receipt: an update without the field (e.g. a status change) keeps it
    const receiptValue = updateOrderDto.DeliveryReceiptImage as unknown;
    if (receiptValue === '' || receiptValue === null) {
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

    // Only an explicit removal ('' or null) deletes the file: an update that
    // does not send InvoicePdf at all (e.g. a status change) keeps it
    const invoicePdfValue = updateOrderDto.InvoicePdf as unknown;
    if (invoicePdfValue === '' || invoicePdfValue === null) {
      if (order.InvoicePdf && !keepsIssuedInvoice) {
        try {
          await this.fileUploadService.deleteFile(order.InvoicePdf);
        } catch (err) {
          this.logger.warn?.(`Failed to delete InvoicePdf: ${String(err)}`);
        }
      }
    }

    // إرجاع المخزون عند الإلغاء
    if ((updateOrderDto.status as string) === 'cancelled') {
      await this.restockCancelledOrder(idParamDto.id);
    }

    // حساب timestamps المناسبة بناءً على الحالة الجديدة
    const statusTimestamps = this.buildStatusTimestamps(
      updateOrderDto.status,
      updateOrderDto.paymentStatus,
    );

    const updatedData = await this.OrderModel.findByIdAndUpdate(
      { _id: idParamDto.id },
      { $set: { ...updateOrderDto, ...statusTimestamps } },
      { new: true, runValidators: true },
    );

    // Tell the customer about a real status change (in-app list + phone push)
    const action = orderStatusNotificationAction(order.status, newStatus);
    if (updatedData?.user && action) {
      const orderUserIdStr = updatedData.user.toString();
      this.eventEmitter.emit(`user.notification.${orderUserIdStr}`, {
        userId: orderUserIdStr,
        action,
        message: this.i18n.translateAll(`notification.${action}`, {
          args: { number: updatedData.invoiceNumber },
        }),
        payload: { orderId: String(updatedData._id), status: newStatus },
      });
    }

    // Marked paid (COD, bank transfer): the tax invoice is issued now and
    // emailed to the customer (once: the mail job skips an invoice already sent)
    if (
      updatedData &&
      order.paymentStatus !== PaymentStatus.PAID &&
      updatedData.paymentStatus === PaymentStatus.PAID
    ) {
      await this.sendPaymentReceived(updatedData);
    }

    return {
      status: 'success',
      data: updatedData,
    };
  }

  /**
   * The dashboard's "resend": the issued invoice emailed again to the
   * customer (the "payment received" email, sent even if it went out before).
   *
   * @throws {NotFoundException} The order has no issued invoice.
   * @throws {BadRequestException} The customer has no email.
   */
  async resendInvoiceEmail(orderId: string): Promise<void> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Invalid order ID');
    }
    const [invoice, order] = await Promise.all([
      this.invoiceService.findIssued(orderId),
      this.OrderModel.findById(orderId),
    ]);
    if (!invoice || !order) {
      throw new NotFoundException('No issued invoice for this order');
    }
    const user = await this.UserModel.findById(order.user)
      .select('email name')
      .lean();
    if (!user?.email) {
      throw new BadRequestException('The customer has no email address');
    }
    await this.orderEmailService.sendPaymentReceivedEmail(
      order,
      { email: user.email, name: user.name },
      { resend: true },
    );
  }

  /** Never throws: the payment is recorded whatever happens to the email. */
  private async sendPaymentReceived(order: HydratedDocument<Order>) {
    try {
      const user = await this.UserModel.findById(order.user)
        .select('email name')
        .lean();
      if (user?.email) {
        await this.orderEmailService.sendPaymentReceivedEmail(order, {
          email: user.email,
          name: user.name,
        });
      }
    } catch (err: unknown) {
      this.logger.error(
        `Payment email for order ${order._id.toString()} failed: ${(err as Error).message}`,
      );
    }
  }
  /**
   * Returns an order's stock when it is cancelled.
   *
   * The status flip is an atomic conditional update (only from a non-final
   * status), so double clicks / concurrent requests restock exactly once, and
   * already cancelled/expired orders (whose stock was already released) are skipped.
   */
  private async restockCancelledOrder(orderId: string) {
    const previous = await this.OrderModel.findOneAndUpdate(
      {
        _id: orderId,
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.EXPIRED] },
      },
      { $set: { status: OrderStatus.CANCELLED } },
      { new: false },
    )
      .select('items paymentMethodCode paymentStatus')
      .lean();

    if (!previous) return;

    // Unpaid Moyasar orders only reserved stock; every other order deducted it
    // (order.created, or confirmReservation once the Moyasar payment succeeded).
    const mode =
      previous.paymentMethodCode === 'moyasar' &&
      previous.paymentStatus !== PaymentStatus.PAID
        ? 'reserved'
        : 'deducted';

    await this.productHelperService.restockOrderItems(previous.items, mode);
  }

  /**
   * Takes stock again when a cancelled/expired order is moved back to an
   * active status (inverse of {@link restockCancelledOrder}).
   *
   * The status flip is an atomic conditional update (only from a closed status),
   * so stock is taken exactly once. If stock is insufficient, the status is
   * rolled back and the request is rejected — nothing stays deducted.
   */
  private async deductReactivatedOrder(orderId: string, newStatus: string) {
    let reactivated: {
      items: Order['items'];
      mode: 'deducted' | 'reserved';
    } | null;
    try {
      // Status flip + stock deduction commit together, or not at all
      reactivated = await withTransactionRetry(
        async (session) => {
          const previous = await this.OrderModel.findOneAndUpdate(
            { _id: orderId, status: { $in: CLOSED_ORDER_STATUSES } },
            { $set: { status: newStatus } },
            { new: false, session },
          )
            .select('items paymentMethodCode paymentStatus')
            .lean();

          if (!previous) return null; // Not a reactivation (order wasn't closed)

          // Mirror of restockCancelledOrder: unpaid Moyasar orders only hold a reservation
          const mode =
            previous.paymentMethodCode === 'moyasar' &&
            previous.paymentStatus !== PaymentStatus.PAID
              ? 'reserved'
              : 'deducted';

          // Throws StockShortageError → transaction aborts, status stays closed
          await this.productHelperService.deductOrderItems(
            previous.items,
            mode,
            session,
          );
          return { items: previous.items, mode };
        },
        this.connection,
        this.logger,
      );
    } catch (error: unknown) {
      if (error instanceof StockShortageError) {
        const s = error.shortage;
        throw new BadRequestException(
          `${this.i18n.translate('exception.INSUFFICIENT_STOCK')} (SKU: ${s.sku ?? s.variantId}, ${s.requested} > ${s.available})`,
        );
      }
      throw error;
    }

    // Post-commit side effects only
    if (reactivated?.mode === 'deducted') {
      await this.productHelperService.afterStockChange(
        reactivated.items.map((i) => i.productId),
      );
    }
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

    // 4) : Delete associated files if any. An issued tax invoice (file and
    // Invoice record) is kept for the tax record.
    const keepsIssuedInvoice = await this.invoiceService.isIssuedInvoiceFile(
      idParamDto.id,
      data.InvoicePdf,
    );
    const paths = [
      keepsIssuedInvoice ? undefined : data.InvoicePdf,
      data.transferReceiptImg,
      data.DeliveryReceiptImage,
    ].filter((p): p is FileAsset => p != null && typeof p === 'object');

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
    chargedTaxAmount?: number;
    productsAmountBeforeTax?: number;
    productsAmountAfterTax?: number;
    taxPercentage?: number;
    taxesIncluded?: boolean;
    applyTaxOnCharges?: boolean;
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
      // Snapshot display data from the validated (DB-fresh) variants so the
      // order keeps showing what was bought even if the catalog changes later.
      const snapshotByVariant = new Map<string, OrderItemSnapshot>(
        validatedItems.map((v) => [v.variant.id.toString(), v.snapshot]),
      );
      const mappedOrderItems = Array.isArray(orderPayload.items)
        ? orderPayload.items.map((item) => ({
            ...item,
            ...snapshotByVariant.get(String(item.variantId)),
            shippingSnapshot: item.shippingSnapshot || item.shippingProfile,
          }))
        : [];

      const newOrder = new this.OrderModel({
        user: orderPayload.user,
        items: mappedOrderItems,
        shippingAddress: {
          ...orderPayload.shippingAddress,
          country: new Types.ObjectId(
            orderPayload.shippingAddress.country as string,
          ),
          region: Types.ObjectId.isValid(
            orderPayload.shippingAddress.region as string,
          )
            ? new Types.ObjectId(orderPayload.shippingAddress.region as string)
            : undefined,
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
        chargedTaxAmount: orderPayload.chargedTaxAmount,
        productsAmountBeforeTax: orderPayload.productsAmountBeforeTax,
        productsAmountAfterTax: orderPayload.productsAmountAfterTax,
        taxPercentage: orderPayload.taxPercentage ?? 0,
        taxesIncluded: !!orderPayload.taxesIncluded,
        applyTaxOnCharges: !!orderPayload.applyTaxOnCharges,
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
        module: AUDIT_MODULES.ORDER,
        userId: orderPayload.user,
        userEmail: orderPayload.userEmail,
        // Summary only: the full order (address, phone…) stays in the order.
        newData: {
          orderId: savedOrder._id.toString(),
          status: savedOrder.status,
          paymentStatus: savedOrder.paymentStatus,
          paymentMethodCode: savedOrder.paymentMethodCode,
          itemsCount: savedOrder.items?.length ?? 0,
          totalQuantity: savedOrder.totalQuantity,
          grandTotal: savedOrder.grandTotal,
          currency: savedOrder.currency,
        },
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
    items: OrderLine[];
    couponDetails?: { couponId?: string; [key: string]: unknown };
  }) {
    const undo: OrderSagaUndo = {};
    try {
      // 1) Re-validate and map items to ValidatedItem type for helper services
      const { validatedItems } =
        await this.orderHelperService.validateOrderItems(payload.items);

      // 2) Decrement Stock
      await this.productHelperService.updateProductStats(validatedItems);
      undo.deducted = validatedItems.map((item) => ({
        productId: item.product.id.toString(),
        variantId: item.variant.id.toString(),
        quantity: item.quantity,
      }));

      // 3) Mark Coupon as used
      if (payload.couponDetails && payload.couponDetails.couponId) {
        await this.couponHelperService.markCouponAsUsed(
          new Types.ObjectId(payload.couponDetails.couponId),
          payload.userId,
        );
        undo.couponId = payload.couponDetails.couponId;
      }

      // 4) Update User order count
      await this.UserModel.findByIdAndUpdate(payload.userId, {
        $inc: { totalOrder: 1 },
      });
      undo.countedOrder = true;
    } catch (err: any) {
      const error = err as Error;
      this.logger.error(
        `Saga 'order.created' Failed: ${error.message}`,
        error.stack,
      );
      // Trigger compensating event
      this.eventEmitter.emit('order.failed', {
        orderId: payload.orderId,
        userId: payload.userId,
        undo,
        reason: error.message,
      });
      return;
    }

    // 5) Emails: only notify about the order once it stands, and never
    // cancel it over a notification (both sends log instead of throwing).
    try {
      const [order, user] = await Promise.all([
        this.OrderModel.findById(payload.orderId),
        this.UserModel.findById(payload.userId).select('email name'),
      ]);
      // Read now, not carried in the event: an order cancelled since its
      // creation gets no "we've received your order" email.
      if (order && user && !CLOSED_ORDER_STATUSES.includes(order.status)) {
        await this.orderEmailService.sendOrderEmail(order, user.email);
        await this.orderEmailService.sendCustomerOrderEmail(order, user);
      }
    } catch (err: any) {
      this.logger.error(
        `Order emails for ${payload.orderId} failed: ${(err as Error).message}`,
      );
    }
  }
  /* ================================================ */
  /*  SAGA: MOYASAR ORDER CREATED EVENT HANDLER       */
  /* ================================================ */
  @OnEvent('order.moyasar_created', { async: true })
  async handleMoyasarOrderCreatedEvent(payload: {
    orderId: string;
    userId: string;
    items: OrderLine[];
    couponDetails?: { couponId?: string; [key: string]: unknown };
  }) {
    try {
      // Only reserve stock here. The coupon and the user's order count are
      // applied in handlePaymentSucceeded, so a failed payment can be retried
      // with the same coupon.
      const { validatedItems } =
        await this.orderHelperService.validateOrderItems(payload.items);
      await this.productHelperService.reserveStock(validatedItems);
    } catch (err: any) {
      const error = err as Error;
      this.logger.error(
        `Saga 'order.moyasar_created' Failed: ${error.message}`,
        error.stack,
      );
      // Reserving is the last step: when it fails nothing is left to undo.
      this.eventEmitter.emit('order.failed', {
        orderId: payload.orderId,
        userId: payload.userId,
        undo: {},
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
      // Only an order still awaiting payment moves forward. A cancelled one
      // (payment failed, superseded, or cancelled by an admin) already released
      // its reservation, so confirming it would take stock twice.
      const order = await this.OrderModel.findOneAndUpdate(
        {
          _id: payload.orderId,
          status: { $in: [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT] },
        },
        {
          status: 'processing',
          paymentStatus: 'PAID',
          ...timestamps,
        },
        { new: true },
      );
      if (!order) {
        await this.OrderModel.findByIdAndUpdate(payload.orderId, {
          paymentStatus: 'PAID',
          ...this.buildStatusTimestamps(undefined, 'PAID'),
        });
        this.logger.error(
          `CRITICAL: payment ${payload.transactionId} captured for order ${payload.orderId} which is no longer awaiting payment — needs manual refund/review`,
        );
        // Alerts the admins who can act on it (PaymentReviewListener).
        this.eventEmitter.emit('payment.needs_review', {
          orderId: payload.orderId,
          transactionId: payload.transactionId,
          amount: payload.amount,
        });
        return;
      }
      if (
        order.paymentMethodCode === 'moyasar' ||
        // Transactions store the provider enum ('MOYASAR').
        payload.provider?.toLowerCase() === 'moyasar'
      ) {
        if (order.couponId) {
          try {
            await this.couponHelperService.markCouponAsUsed(
              new Types.ObjectId(String(order.couponId)),
              String(order.user),
            );
          } catch (couponErr: unknown) {
            // The customer has paid: never undo the order over a coupon race.
            this.logger.warn(
              `Coupon ${String(order.couponId)} could not be marked as used for paid order ${payload.orderId}: ${(couponErr as Error).message}`,
            );
          }
        }
        await this.UserModel.findByIdAndUpdate(order.user, {
          $inc: { totalOrder: 1 },
        });

        // Confirmed from the stored lines, never re-validated: every paid
        // line must leave its reservation, even if its product changed since.
        await this.productHelperService.confirmReservation(order.items);

        const user = await this.UserModel.findById(order.user);
        if (user) {
          await this.orderEmailService.sendOrderEmail(order, user.email);
          await this.orderEmailService.sendCustomerOrderEmail(order, user);
        }
      }
    } catch (err: any) {
      const error = err as Error;
      this.logger.error(
        `payment.succeeded failed for order ${payload.orderId}: ${error.message}`,
        error.stack,
      );
    } finally {
      await this.invalidateOrderCache();
    }
  }

  /* ================================================ */
  /*  SAGA: PAYMENT REFUNDED (Moyasar dashboard)      */
  /* ================================================ */
  /**
   * Applies a refund made in the Moyasar dashboard to the order:
   * - partial: recorded only (PARTIALLY_REFUNDED + amount), the order goes on;
   * - full, not shipped yet: the order is cancelled, its stock returned and
   *   its coupon released for the customer;
   * - full, already shipped/delivered (or closed): recorded only (REFUNDED);
   *   goods coming back are restocked by hand when received.
   * The customer is emailed in every case. The cancel is a conditional flip,
   * so stock and coupon are returned at most once.
   */
  @OnEvent('payment.refunded', { async: true })
  async handlePaymentRefunded(payload: PaymentRefundedEvent) {
    this.logger.log(`Handling payment.refunded for order ${payload.orderId}`);
    try {
      const refund = {
        refundedAmount: payload.refundedAmount,
        refundedAt: new Date(),
      };
      let cancelled = false;

      if (payload.isFull) {
        const previous = await this.OrderModel.findOneAndUpdate(
          {
            _id: payload.orderId,
            status: {
              $in: [
                OrderStatus.PENDING_PAYMENT,
                OrderStatus.PENDING,
                OrderStatus.PROCESSING,
              ],
            },
          },
          {
            $set: {
              status: OrderStatus.CANCELLED,
              paymentStatus: PaymentStatus.REFUNDED,
              ...refund,
              ...this.buildStatusTimestamps('cancelled'),
            },
          },
          { new: false },
        )
          .select('items user couponId paymentMethodCode paymentStatus')
          .lean();

        if (previous) {
          cancelled = true;
          // Same rule as restockCancelledOrder: a paid Moyasar order deducted
          // its stock (confirmReservation); an unpaid one only reserved it.
          const mode =
            previous.paymentMethodCode === 'moyasar' &&
            previous.paymentStatus !== PaymentStatus.PAID &&
            previous.paymentStatus !== PaymentStatus.PARTIALLY_REFUNDED
              ? 'reserved'
              : 'deducted';
          if (mode === 'reserved') {
            // Never paid: no sale, no invoice, only a reservation to release
            await this.productHelperService.restockOrderItems(
              previous.items,
              mode,
            );
          } else {
            // A sale: the credit note returns what no return has taken yet
            await this.creditFullRefund(payload, previous.items, true);
          }
          if (previous.couponId) {
            await this.couponHelperService.releaseCouponUsage(
              new Types.ObjectId(String(previous.couponId)),
              String(previous.user),
            );
          }
        } else {
          await this.OrderModel.updateOne(
            { _id: payload.orderId },
            { $set: { paymentStatus: PaymentStatus.REFUNDED, ...refund } },
          );
          // Shipped already: credited, but the stock stays out (as before)
          await this.creditFullRefund(payload, [], false);
        }
      } else {
        await this.OrderModel.updateOne(
          { _id: payload.orderId },
          {
            $set: {
              paymentStatus: PaymentStatus.PARTIALLY_REFUNDED,
              ...refund,
            },
          },
        );
      }

      const order = await this.OrderModel.findById(payload.orderId)
        .select('user invoiceNumber')
        .lean();
      const user = order
        ? await this.UserModel.findById(order.user).select('email').lean()
        : null;
      // One email per refund: a credit note covering it (a return, or the full
      // refund's own) emails the customer itself, with the refund in it
      if (user?.email && !(await this.refundHasCreditNote(payload))) {
        await this.orderEmailService.sendRefundEmail({
          email: user.email,
          orderId: payload.orderId,
          invoiceNumber: order?.invoiceNumber,
          refundedAmount: payload.refundedAmount,
          currency: payload.currency,
          isFull: payload.isFull,
          cancelled,
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `payment.refunded failed for order ${payload.orderId}: ${error.message}`,
        error.stack,
      );
    } finally {
      await this.invalidateOrderCache();
    }
  }

  /**
   * The order's credit notes for its pages, file URLs absolute. The
   * customer sees issued ones only, without the internal fields.
   */
  private async creditNotesFor(orderId: string, forCustomer: boolean) {
    const notes = await this.orderCreditNoteService.list(orderId);
    return notes
      .filter((n) => !forCustomer || n.state === 'issued')
      .map((n) => {
        const file = n.file?.url
          ? { ...n.file, url: String(withBaseUrl(n.file.url)) }
          : undefined;
        return forCustomer
          ? {
              _id: n._id,
              displayNumber: n.displayNumber,
              issuedAt: n.issuedAt,
              total: n.amounts.total,
              reasonType: n.reasonType,
              // What came back: less the return shipping (other reasons)
              returnShipping: n.deductions?.returnShipping?.total ?? 0,
              refund: n.refund,
              file,
            }
          : { ...n, file };
      });
  }

  /**
   * The order's return requests and its return window (the setting
   * `returnWindowDays`, after delivery). The customer gets their requests without the admin's
   * bookkeeping fields.
   */
  private async returnsFor(order: PopulatedOrderData, forCustomer: boolean) {
    const requests = await this.orderReturnRequestService.listForOrder(
      String(order._id),
    );
    return {
      returnPolicy: {
        ...this.orderReturnRequestService.policyFor(
          order as { status?: string; deliveredAt?: Date; completedAt?: Date },
          await this.orderReturnRequestService.windowDays(),
        ),
        // The customer's return dialog: what each line has left
        ...(forCustomer && {
          remaining: await this.orderReturnRequestService.returnable(
            String(order._id),
          ),
        }),
      },
      returnRequests: forCustomer
        ? requests.map((r) => ({
            _id: r._id,
            lines: r.lines,
            reasonType: r.reasonType,
            note: r.note,
            status: r.status,
            rejectionReason: r.rejectionReason,
            creditNote: r.creditNote,
            createdAt: r.createdAt,
            decidedAt: r.decidedAt,
          }))
        : requests,
    };
  }

  /** True when credit notes account for all the money refunded so far. */
  private async refundHasCreditNote(
    payload: PaymentRefundedEvent,
  ): Promise<boolean> {
    try {
      return await this.orderCreditNoteService.coversRefund(
        payload.orderId,
        payload.refundedAmount,
      );
    } catch (err: unknown) {
      // Unknown: better a second email than none about the refund
      this.logger.warn(
        `Could not check the credit notes of order ${payload.orderId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * A full refund's tax credit note: every line no return has taken yet,
   * restocked through it when `restock`. With no issued invoice nothing can
   * be credited: the lines are restocked directly, as before credit notes.
   * Never throws: the refund is already recorded.
   */
  private async creditFullRefund(
    payload: PaymentRefundedEvent,
    items: Order['items'],
    restock: boolean,
  ) {
    try {
      const { invoiceIssued } =
        await this.orderCreditNoteService.createForFullRefund(
          payload.orderId,
          payload.transactionId,
          restock,
        );
      if (!invoiceIssued && restock) {
        await this.productHelperService.restockOrderItems(items, 'deducted');
      }
    } catch (err: unknown) {
      this.logger.error(
        `CRITICAL: full refund of order ${payload.orderId} recorded, but its credit note failed (issue it from the dashboard; stock not returned): ${(err as Error).message}`,
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
      // A failed payment closes the order: the cart is still intact, so the
      // customer retries with a fresh checkout. The status condition makes the
      // reservation release happen at most once.
      const timestamps = this.buildStatusTimestamps('cancelled', 'FAILED');
      const order = await this.OrderModel.findOneAndUpdate(
        {
          _id: payload.orderId,
          status: { $in: [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT] },
          paymentStatus: { $ne: PaymentStatus.PAID },
        },
        {
          status: OrderStatus.CANCELLED,
          paymentStatus: 'FAILED',
          ...timestamps,
        },
        { new: true },
      );
      if (order && order.paymentMethodCode === 'moyasar') {
        // Release from the stored lines, not re-validated items: validation
        // counts this order's own reservation as unavailable stock and would
        // drop the line, leaving its reservation stuck forever.
        await this.productHelperService.restockOrderItems(
          order.items,
          'reserved',
        );
      }
    } catch (err: any) {
      const error = err as Error;
      this.logger.error(
        `payment.failed handler failed: ${error.message}`,
        error.stack,
      );
    } finally {
      await this.invalidateOrderCache();
    }
  }

  /* ================================================ */
  /*  SUPERSEDE UNPAID MOYASAR ORDERS                 */
  /* ================================================ */
  /**
   * Cancels a user's Moyasar orders that are still awaiting payment, before
   * they start a new checkout. Their cart was kept, so the new order replaces
   * them; releasing their reservations first keeps them from counting against
   * stock in the new order's validation. Bank transfer / COD orders are never
   * touched.
   */
  @OnEvent('checkout.supersedeUnpaidOrders')
  async handleSupersedeUnpaidOrders(payload: { userId: string }) {
    try {
      const openOrders = await this.OrderModel.find({
        user: new Types.ObjectId(payload.userId),
        paymentMethodCode: 'moyasar',
        status: { $in: [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT] },
        paymentStatus: { $ne: PaymentStatus.PAID },
      })
        .select('_id')
        .lean();

      for (const { _id } of openOrders) {
        // Same atomic flip as restockCancelledOrder: a webhook that marks the
        // order paid at this moment makes the update match nothing.
        const previous = await this.OrderModel.findOneAndUpdate(
          {
            _id,
            status: { $in: [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT] },
            paymentStatus: { $ne: PaymentStatus.PAID },
          },
          {
            $set: {
              status: OrderStatus.CANCELLED,
              ...this.buildStatusTimestamps('cancelled'),
            },
          },
          { new: false },
        )
          .select('items')
          .lean();
        if (!previous) continue;

        await this.productHelperService.restockOrderItems(
          previous.items,
          'reserved',
        );
        this.logger.log(
          `Order ${String(_id)} superseded by a new checkout of user ${payload.userId}`,
        );
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Superseding unpaid orders of user ${payload.userId} failed: ${error.message}`,
        error.stack,
      );
    } finally {
      await this.invalidateOrderCache();
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
      // Only an order still awaiting payment expires: if it was paid,
      // cancelled or already expired, its reservation was settled elsewhere
      // and releasing it again would free stock held by other orders.
      const order = await this.OrderModel.findOneAndUpdate(
        {
          _id: payload.orderId,
          status: { $in: [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT] },
          paymentStatus: { $ne: PaymentStatus.PAID },
        },
        { status: 'expired', paymentStatus: 'FAILED', ...timestamps },
        { new: true },
      );
      if (!order) {
        this.logger.log(
          `payment.expired ignored: order ${payload.orderId} is no longer awaiting payment`,
        );
        return;
      }
      if (order.paymentMethodCode === 'moyasar') {
        // Stored lines, not re-validated items (see handlePaymentFailed).
        await this.productHelperService.restockOrderItems(
          order.items,
          'reserved',
        );
      }
    } catch (err: any) {
      const error = err as Error;
      this.logger.error(
        `payment.expired handler failed: ${error.message}`,
        error.stack,
      );
    } finally {
      await this.invalidateOrderCache();
    }
  }

  /* ================================================ */
  /*  SAGA: COMPENSATING EVENT (ORDER FAILED)         */
  /* ================================================ */
  @OnEvent('order.failed', { async: true })
  async handleOrderFailedEvent(payload: {
    orderId: string;
    userId: string;
    undo: OrderSagaUndo;
    reason?: string;
  }) {
    this.logger.warn(
      `Compensating Actions for failed order ${payload.orderId}: ${payload.reason}`,
    );

    try {
      // 1) Mark order as cancelled — conditional, so the undo runs at most once
      const cancelled = await this.OrderModel.findOneAndUpdate(
        { _id: payload.orderId, status: { $ne: OrderStatus.CANCELLED } },
        {
          status: OrderStatus.CANCELLED,
          notes: `Cancelled due to system failure: ${payload.reason}`,
          ...this.buildStatusTimestamps('cancelled'),
        },
      );
      if (!cancelled) return;

      const { deducted, reserved, couponId, countedOrder } = payload.undo;

      // 2) Give back the stock the saga took (atomic, clamped at 0)
      if (deducted?.length) {
        await this.productHelperService.restockOrderItems(deducted, 'deducted');
      }
      if (reserved?.length) {
        await this.productHelperService.restockOrderItems(reserved, 'reserved');
      }

      // 3) Release the coupon so the customer can use it again
      if (couponId) {
        await this.couponHelperService.releaseCouponUsage(
          new Types.ObjectId(couponId),
          payload.userId,
        );
      }

      // 4) This order no longer counts for the user
      if (countedOrder) {
        await this.UserModel.findByIdAndUpdate(payload.userId, {
          $inc: { totalOrder: -1 },
        });
      }
    } catch (err: any) {
      const error = err as Error;
      // Very bad if compensating event fails. Should be logged to DLQ or manually inspected.
      this.logger.error(
        `CRITICAL: Compensating Action for 'order.failed' crashed: ${error.message}`,
        error.stack,
      );
    } finally {
      await this.invalidateOrderCache();
    }
  }
}
