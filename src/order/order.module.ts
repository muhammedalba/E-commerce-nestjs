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
import { Order, OrderSchema } from './shared/schemas/Order.schema';
import { AuthModule } from 'src/auth/auth.module';
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
import { AuditModule } from '../audit/audit.module';
import { ProductSyncModule } from 'src/products/products-helper/product-sync.module';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: Coupon.name, schema: CouponSchema }]),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    MongooseModule.forFeature([
      { name: ProductVariant.name, schema: ProductVariantSchema },
    ]),
    EmailModule,
    AuditModule,
    CouponsModule,
    ProductSyncModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    MarketingStatisticsService,
    OrderHelperService,
    OrderEmailService,
    ProductHelperService,
    OrdersStatisticsService,
  ],
  exports: [OrdersStatisticsService],
})
export class OrderModule {}
