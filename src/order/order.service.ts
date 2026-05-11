import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateOrderDto } from './shared/dto/create-order.dto';
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
import { CheckoutService } from '../checkout/checkout.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/shared/schema/audit-log.schema';

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
    private readonly checkoutService: CheckoutService,
    private readonly auditService: AuditService,
    @InjectConnection() private readonly connection: Connection,
  ) {}
  private readonly logger = new Logger(OrderService.name);

  async OrdersStatistics(startDate?: string, endDate?: string) {
    return await this.ordersStatisticsService.OrdersStatistics(
      startDate,
      endDate,
    );
  }

  async PaymentByBankTransfer(
    userId: string,
    user_email: string,
    dto: CreateOrderDto,
    file: MulterFileType,
  ) {
    // 1) Handle file upload
    let transferReceiptImg: string | undefined;
    if (file) {
      transferReceiptImg = await this.fileUploadService.saveFileToDisk(
        file,
        'orders',
      );
    }

    // 2) Delegate to the new enterprise placeOrder method
    // This ensures all tax, shipping, and payment fee calculations are consistent
    return await this.placeOrder(userId, user_email, dto, transferReceiptImg);
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
      throw new BadRequestException(
        'Ã™â€¦Ã˜Â¹Ã˜Â±Ã™Â Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂºÃ™Å Ã˜Â± Ã˜ÂµÃ˜Â§Ã™â€žÃ˜Â­',
      );
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
      throw new BadRequestException(
        'Ã™â€¦Ã˜Â¹Ã˜Â±Ã™Â Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂºÃ™Å Ã˜Â± Ã˜ÂµÃ˜Â§Ã™â€žÃ˜Â­',
      );
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
    return {
      status: 'success',
      data: updatedData,
    };
  }

  async remove(idParamDto: IdParamDto) {
    // 1) : Validate ID format
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idParamDto.id);
    if (!isObjectId) {
      throw new BadRequestException(
        'Ã™â€¦Ã˜Â¹Ã˜Â±Ã™Â Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂºÃ™Å Ã˜Â± Ã˜ÂµÃ˜Â§Ã™â€žÃ˜Â­',
      );
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
        this.logger.warn?.(
          'Ã™ÂÃ˜Â´Ã™â€ž Ã˜Â­Ã˜Â°Ã™Â Ã˜Â§Ã™â€žÃ™â€¦Ã™â€žÃ™ÂÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨',
          err,
        );
      }
    }
  }

  /* ================================================ */
  /*  PLACE ORDER - New Enterprise Logic              */
  /* ================================================ */
  async placeOrder(
    userId: string,
    userEmail: string,
    dto: CreateOrderDto,
    transferReceiptImg?: string,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1) Get Checkout Preview (Validation & Calculation)
      const checkoutPreview = await this.checkoutService.getCheckoutPreview(
        {
          items: dto.items as any,
          cityId: dto.cityId,
          paymentMethodId: dto.paymentMethodId,
          shippingProviderId: dto.shippingProviderId,
          couponCode: dto.couponCode,
        },
        userId,
      );

      // 2) Validate stock and items (Reuse existing helper if possible, or use logic from checkout)
      // Note: CheckoutService already validated product existence and prices.
      // We still need to decrement stock.
      const { validatedItems } =
        await this.orderHelperService.validateOrderItems(dto.items);

      // 3) Create Order Document
      const newOrder = new this.OrderModel({
        user: userId,
        items: dto.items,
        shippingAddress: dto.shippingAddress,

        // Enterprise Commerce Fields
        shippingProviderId: new Types.ObjectId(
          checkoutPreview.delivery.providerId,
        ),
        shippingRateId: new Types.ObjectId(checkoutPreview.delivery.rateId),
        paymentMethodId: new Types.ObjectId(dto.paymentMethodId),

        shippingAmount: checkoutPreview.summary.shippingCost,
        taxAmount: checkoutPreview.summary.taxAmount,
        paymentFees: checkoutPreview.summary.paymentFees,
        totalPrice: checkoutPreview.summary.subtotal,
        discountAmount: checkoutPreview.summary.discount,
        grandTotal: checkoutPreview.summary.total,
        currency: checkoutPreview.summary.currency,

        status: 'pending',
        paymentStatus: 'pending',
        isCheckedOut: true,
        checkedOutAt: new Date(),
        checkoutSummary: checkoutPreview,
        notes: dto.notes,
        transferReceiptImg: transferReceiptImg || dto.transferReceiptImg,
      });

      const savedOrder = await newOrder.save({ session });

      // 5) If there is a coupon used, record it and the user's record in the database.
      if (checkoutPreview.couponDetails) {
        await this.couponHelperService.markCouponAsUsed(
          checkoutPreview.couponDetails.CouponId,
          userId,
        );
      }

      // 6) Update user total orders count
      await this.UserModel.findByIdAndUpdate(
        userId,
        { $inc: { totalOrder: 1 } },
        { session },
      );

      // 7) Clear User Cart (Assuming CartModule is available)
      // TODO: Implement cart clearing if cart service is injected

      // 8) Audit Log
      await this.auditService.log(
        {
          action: AuditAction.ORDER_PLACED,
          module: 'ORDER',
          userId,
          userEmail,
          newData: savedOrder.toObject(),
          previousData: {},
        },
        session,
      );

      // 7) Send Email
      await this.orderEmailService.sendOrderEmail(
        savedOrder,
        validatedItems,
        userEmail,
      );

      await session.commitTransaction();
      return {
        success: true,
        message: this.i18n.translate('success.ORDER_CREATED_SUCCESSFULLY'),
        orderId: savedOrder._id,
        data: savedOrder,
      };
    } catch (error: any) {
      await session.abortTransaction();
      this.logger.error(
        `Order Placement Failed: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      session.endSession();
    }
  }
}
