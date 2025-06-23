import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Product,
  ProductSchema,
} from 'src/products/shared/schemas/Product.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { Order, OrderSchema } from './shared/schemas/Order.schema';
import { AuthModule } from 'src/auth/auth.module';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import {
  Coupon,
  CouponSchema,
} from 'src/coupons/shared/Schemas/coupons.schema';
import { EmailModule } from 'src/email/email.module';
import { OrderHelperService } from './shared/order-helper/order-helper.service';
import { OrderEmailService } from './shared/order-helper/order-email.service';
import { CouponHelperService } from './shared/order-helper/coupon.helper';
import { ProductHelperService } from './shared/order-helper/product.helper';
import { OrdersStatisticsService } from './shared/order-helper/order-statistics.service';

@Module({
  imports: [
    AuthModule,
    FileUploadDiskStorageModule,
    MongooseModule.forFeature([{ name: Coupon.name, schema: CouponSchema }]),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    EmailModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    CustomI18nService,
    OrderHelperService,
    OrderEmailService,
    CouponHelperService,
    ProductHelperService,
    OrdersStatisticsService,
  ],
})
export class OrderModule {}
