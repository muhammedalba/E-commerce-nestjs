import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullConfig } from './config/bull.config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { WishlistModule } from './wishlist/wishlist.module';
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
import { PushModule } from './notifications/push/push.module';
import { AppVersionsModule } from './app-versions/app-versions.module';
import { ContactModule } from './contact/contact.module';
import { QuoteRequestsModule } from './quote-requests/quote-requests.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FileUploadDiskStorageModule } from './file-upload/file-upload.module';
import { SharedModule } from './shared/shared.module';
import { RedisModule } from './shared/redis/redis.module';
import { appProviders } from './app.providers';
import { createKeyv } from 'cacheable';

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
    // Bounded in-process cache: LRU-capped and swept for expired entries.
    // (The default Map store has no size limit and only drops expired entries
    // when they are read again — unbounded growth with user-controlled keys.)
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const store = createKeyv({
          lruSize: config.get<number>('CACHE_MAX_ITEMS', 1000),
          checkInterval: config.get<number>('CACHE_CHECK_INTERVAL_MS', 60_000),
        });
        // createKeyv disables serialization, so values are stored via
        // structuredClone, which turns ObjectIds into `{ buffer: {...} }`.
        // Store JSON instead — the same shape the client receives uncached.
        store.serialize = JSON.stringify;
        store.deserialize = JSON.parse;
        return { stores: [store] };
      },
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
    WishlistModule,
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
    PushModule,
    AppVersionsModule,
    ContactModule,
    QuoteRequestsModule,
    ReviewsModule,
    FileUploadDiskStorageModule,
    SharedModule,
    RedisModule,
  ],
  controllers: [AppController],
  providers: [...appProviders],
})
export class AppModule {}
