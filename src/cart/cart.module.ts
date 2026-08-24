import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { Cart, CartSchema } from './shared/schemas/cart.schema';
import { AuthModule } from 'src/auth/auth.module';
import { ProductsModule } from 'src/products/products.module';
import { SettingsModule } from 'src/settings/settings.module';
import {
  Product,
  ProductSchema,
} from 'src/products/shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantSchema,
} from 'src/products/shared/schemas/ProductVariant.schema';
import { CouponsModule } from 'src/coupons/coupons.module';

@Module({
  imports: [
    AuthModule,
    ProductsModule,
    SettingsModule,
    CouponsModule,
    MongooseModule.forFeature([{ name: Cart.name, schema: CartSchema }]),
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    MongooseModule.forFeature([
      { name: ProductVariant.name, schema: ProductVariantSchema },
    ]),
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
