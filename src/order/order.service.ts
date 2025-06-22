import { BadRequestException, Injectable } from '@nestjs/common';
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
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';

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
    //1) check order items is validate
    const {
      validatedItems,
      totalPrice,
      totalQuantity,
      updatedProducts,
      unAvailableProducts,
    } = await this.orderHelperService.validateOrderItems(dto.items);
    //1.1)
    const productItemsId = validatedItems.map((item) => ({
      productId: item.product.id.toString(),
      quantity: item.quantity,
      totalPrice: item.totalPrice ?? 0,
    }));
    // 2) if coupon is exist apply
    const { discountAmount, totalPriceAfterDiscount, couponDetails } =
      await this.couponHelperService.applyCouponIfAvailable(
        dto.couponCode,
        userId,
        totalPrice,
      );
    // 3) handel file
    if (file) {
      const filePath = await this.fileUploadService.saveFileToDisk(
        file,
        'orders',
      );
      dto.transferReceiptImg = filePath;
    }
    // 4) create new order
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
      checkedOutAt: Date.now(),
      paymentStatus: 'paid',
    };
    const order = await this.OrderModel.create(newOrder);
    // 5) If there is a coupon used, record it and the user's record in the database.
    if (couponDetails) {
      await this.couponHelperService.markCouponAsUsed(
        couponDetails.CouponId,
        userId,
      );
    }
    // 6) Modify the number of products and sales of sold products
    await this.productHelperService.updateProductStats(validatedItems);
    // 7) send email to admin (you have new order)
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
        message: this.i18n.translate(
          'exception.coupon.SOME_PRODUCTS_HAVE_LESS_QUANTITY',
        ),
        data: updatedProducts,
      },
      ...(unAvailableProducts && {
        unAvailableProducts: {
          message: this.i18n.translate(
            'exception.coupon.INVALID_SOME_PRODUCTS',
          ),
          data: unAvailableProducts,
        },
      }),
    };
  }

  async findAll(user: JwtPayload, queryString: QueryString) {
    queryString.fields =
      'totalPrice totalQuantity totalPriceAfterDiscount couponCode discountAmount paymentStatus isCheckedOut status paymentMethod ';
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
      throw new BadRequestException('معرف الطلب غير صالح');
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
      throw new BadRequestException('معرف الطلب غير صالح');
    }
    const order = await this.OrderModel.findById(idParamDto.id).select(
      'transferReceiptImg InvoicePdf DeliveryReceiptImage',
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
      );
      updateOrderDto.InvoicePdf = newPdfPath;
    }
    if (files.transferReceiptImg) {
      const newPath = await this.fileUploadService.updateFile(
        files.transferReceiptImg[0] as MulterFileType,
        'orders',
        order,
      );
      updateOrderDto.transferReceiptImg = newPath;
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
    // 1) check id is valid
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idParamDto.id);
    if (!isObjectId) {
      throw new BadRequestException('معرف الطلب غير صالح');
    }
    // 2) get order from db
    const data = await this.OrderModel.findById(idParamDto.id)
      .select('transferReceiptImg')
      .lean();
    if (!data) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }
    // 3) delete file
    if (data.transferReceiptImg) {
      await this.fileUploadService.deleteFile(`.${data.transferReceiptImg}`);
    }
    return;
  }
}
