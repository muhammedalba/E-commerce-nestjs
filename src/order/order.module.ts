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
import { SettingsModule } from '../settings/settings.module';
import { ProductSyncModule } from 'src/products/products-helper/product-sync.module';
import { InvoiceModule } from 'src/invoice/invoice.module';
import { PaymentsModule } from 'src/payments/payments.module';
import { ShippingModule } from 'src/shipping/shipping.module';
import { Role, RoleSchema } from 'src/roles/shared/schemas/role.schema';
import {
  ReturnRequest,
  ReturnRequestSchema,
} from './shared/schemas/return-request.schema';
import { OrderReturnRequestService } from './shared/order-helper/order-return-request.service';
import { InvoicesController } from './invoices.controller';
import { OrderCreditNoteService } from './shared/order-helper/order-credit-note.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: Coupon.name, schema: CouponSchema }]),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    MongooseModule.forFeature([
      { name: ReturnRequest.name, schema: ReturnRequestSchema },
      // Read-only: who to notify about a return request
      { name: Role.name, schema: RoleSchema },
    ]),
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    MongooseModule.forFeature([
      { name: ProductVariant.name, schema: ProductVariantSchema },
    ]),
    EmailModule,
    SettingsModule,
    AuditModule,
    CouponsModule,
    ProductSyncModule,
    InvoiceModule,
    PaymentsModule,
    // Return shipping, priced like checkout (OrderCreditNoteService)
    ShippingModule,
  ],
  controllers: [OrderController, InvoicesController],
  providers: [
    OrderService,
    MarketingStatisticsService,
    OrderHelperService,
    OrderEmailService,
    ProductHelperService,
    OrdersStatisticsService,
    OrderCreditNoteService,
    OrderReturnRequestService,
  ],
  exports: [OrdersStatisticsService],
})
export class OrderModule {}
