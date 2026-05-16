import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullConfig } from './config/bull.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
import { CustomI18nValidationExceptionFilter } from './filters/i18n-validation-exception.filter';
import { PromoBannerModule } from './promo-banner/promo-banner.module';
import { SubCategoryModule } from './sub-category/sub-category.module';
import { SupplierModule } from './supplier/supplier.module';
import { ExistsConstraint } from './shared/utils/decorators/exists.decorator';
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

import { MaintenanceGuard } from './shared/guards/maintenance.guard';

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
    EventEmitterModule.forRoot(),
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
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
    AppService,
    ExistsConstraint,
    CustomI18nValidationExceptionFilter,
  ],
})
export class AppModule {}
