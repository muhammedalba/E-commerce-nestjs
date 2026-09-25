import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WishlistService } from './wishlist.service';
import { WishlistController } from './wishlist.controller';
import { Wishlist, WishlistSchema } from './shared/schemas/wishlist.schema';
import { WishlistEnabledGuard } from './shared/guards/wishlist-enabled.guard';
import { AuthModule } from 'src/auth/auth.module';
import { SettingsModule } from 'src/settings/settings.module';
import {
  Product,
  ProductSchema,
} from 'src/products/shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantSchema,
} from 'src/products/shared/schemas/ProductVariant.schema';

@Module({
  imports: [
    AuthModule,
    SettingsModule,
    MongooseModule.forFeature([
      { name: Wishlist.name, schema: WishlistSchema },
    ]),
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    // Needed to populate the `variants` virtual on wishlist products
    MongooseModule.forFeature([
      { name: ProductVariant.name, schema: ProductVariantSchema },
    ]),
  ],
  controllers: [WishlistController],
  providers: [WishlistService, WishlistEnabledGuard],
  exports: [WishlistService],
})
export class WishlistModule {}
