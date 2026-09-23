import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantSchema,
} from '../shared/schemas/ProductVariant.schema';
import { AggregationSyncService } from './aggregation-sync.service';

/**
 * Single home of AggregationSyncService (one instance → one `variant.changed`
 * listener), shared by ProductsModule and OrderModule so order stock changes
 * can await the aggregate recompute + cache invalidation before responding.
 * Depends only on models and global shared services (no circular import).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductVariant.name, schema: ProductVariantSchema },
    ]),
  ],
  providers: [AggregationSyncService],
  exports: [AggregationSyncService],
})
export class ProductSyncModule {}
