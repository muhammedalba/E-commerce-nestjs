import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Product,
  ProductSchema,
} from 'src/products/shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantSchema,
} from 'src/products/shared/schemas/ProductVariant.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { Order, OrderSchema } from './shared/schemas/Order.schema';
import { AuthModule } from 'src/auth/auth.module';
import { FileUploadDiskStorageModule } from 'src/file-upload/file-upload.module';
import {
  Coupon,
  CouponSchema,
} from 'src/coupons/shared/Schemas/coupons.schema';
import { EmailModule } from 'src/email/email.module';
import { OrderHelperService } from './shared/order-helper/order-helper.service';
import { OrderEmailService } from './shared/order-helper/order-email.service';
import { CouponsModule } from '../coupons/coupons.module';
import { ProductHelperService } from './shared/order-helper/product.helper';
import { OrdersStatisticsService } from './shared/order-helper/order-statistics.service';
import { MarketingStatisticsService } from './shared/order-helper/marketing-statistics.service';
import { CheckoutModule } from '../checkout/checkout.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AuthModule,
    FileUploadDiskStorageModule,
    MongooseModule.forFeature([{ name: Coupon.name, schema: CouponSchema }]),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    MongooseModule.forFeature([
      { name: ProductVariant.name, schema: ProductVariantSchema },
    ]),
    EmailModule,
    CheckoutModule,
    AuditModule,
    CouponsModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    MarketingStatisticsService,
    CustomI18nService,
    OrderHelperService,
    OrderEmailService,
    ProductHelperService,
    OrdersStatisticsService,
  ],
  exports: [OrdersStatisticsService],
})
export class OrderModule {}
