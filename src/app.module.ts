import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullConfig } from './config/bull.config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { MongooseConfig } from './config/db/mongoose.config';
import { I18nConfig } from './config/i18n/i18n.config';
import { StaticConfig } from './config/static.config';
import { JwtConfig } from './config/jwt/jwt.config';
import { CategoriesModule } from './categories/categories.module';
import { CarouselModule } from './carousel/carousel.module';
import { CouponsModule } from './coupons/coupons.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { PromoBannerModule } from './promo-banner/promo-banner.module';
import { SubCategoryModule } from './sub-category/sub-category.module';
import { SupplierModule } from './supplier/supplier.module';
import { CacheModule } from '@nestjs/cache-manager';
// ======= New Modules =======
import { SettingsModule } from './settings/settings.module';
import { TaxesModule } from './taxes/taxes.module';
import { LocationsModule } from './locations/locations.module';
import { ShippingModule } from './shipping/shipping.module';
import { PaymentsModule } from './payments/payments.module';
import { AuditModule } from './audit/audit.module';
import { CheckoutModule } from './checkout/checkout.module';
import { SeedModule } from './seed/seed.module';
import { RolesModule } from './roles/roles.module';
import { NotificationsModule } from './notifications/notifications.module';
import { appProviders } from './app.providers';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    // rate limiting (تحديد عدد الطلبات)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CacheModule.register({
      isGlobal: true,
    }),
    BullConfig,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    ScheduleModule.forRoot(),
    I18nConfig,
    MongooseConfig,
    StaticConfig,
    JwtConfig,

    // ======= Core Modules =======
    AuthModule,
    UsersModule,
    BrandsModule,
    CategoriesModule,
    CarouselModule,
    CouponsModule,
    ProductsModule,
    CartModule,
    OrderModule,
    PromoBannerModule,
    SubCategoryModule,
    SupplierModule,

    // ======= New Commerce Modules =======
    SettingsModule,
    TaxesModule,
    LocationsModule,
    ShippingModule,
    PaymentsModule,
    AuditModule,
    CheckoutModule,
    SeedModule,
    RolesModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [...appProviders],
})
export class AppModule {}
