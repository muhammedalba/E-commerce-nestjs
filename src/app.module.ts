import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { Redis } from 'ioredis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
import { OrderModule } from './order/order.module';
import { CustomI18nValidationExceptionFilter } from './filters/i18n-validation-exception.filter';
import { PromoBannerModule } from './promo-banner/promo-banner.module';
import { SubCategoryModule } from './sub-category/sub-category.module';
import { SupplierModule } from './supplier/supplier.module';
import { ExistsConstraint } from './shared/utils/decorators/exists.decorator';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CacheModule.register({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        return {
          connection: new Redis(redisUrl!, {
            // ضروري لـ Upstash لتخطي أخطاء التحقق من شهادات SSL
            tls: redisUrl?.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
          }),
        };
      },
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    I18nConfig,
    MongooseConfig, 
    StaticConfig, 
    JwtConfig,
    
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
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService,
    ExistsConstraint,
    CustomI18nValidationExceptionFilter,
  ],
})
export class AppModule { }
