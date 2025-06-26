import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
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
import { SupCategoryModule } from './sup-category/sup-category.module';
import { SupplierModule } from './supplier/supplier.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
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
    SupCategoryModule,
    SupplierModule,
  ],
  controllers: [AppController],
  providers: [AppService, CustomI18nValidationExceptionFilter],
})
export class AppModule {}
