import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from '../shared/schemas/ProductVariant.schema';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheInvalidationService } from 'src/shared/services/cache-invalidation.service';
import { RevalidationService } from 'src/shared/services/revalidation.service';

/**
 * An event triggered when variants for a specific product are created, updated, or deleted.
 *
 * This event carries only the product ID and is used to recalculate
 * the aggregate statistics stored directly on the product document.
 */
export class VariantChangedEvent {
  constructor(public readonly productId: Types.ObjectId) {}
}

/**
 * Shape of the document returned by the variant aggregation pipeline.
 */
interface VariantStatsResult {
  _id: unknown;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  count: number;
}

@Injectable()
export class AggregationSyncService {
  private readonly logger = new Logger(AggregationSyncService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariantDocument>,
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly revalidationService: RevalidationService,
  ) {}

  /**
   * It recalculates the product's aggregated statistics after any change to the variants.
   *
   * ---
   * ## Purpose (Pre-aggregation Pattern)
   *
   * Instead of calculating these values in every expensive `$lookup` search query,
   * they are calculated once when the change occurs and stored directly on the product.
   * This makes read and filter operations immediate and without joins.
   *
   * ---
   * ## Fields updated on the product
   *
   * | Field              | Source                              | Usage                              |
   * |--------------------|--------------------------------------|----------------------------------------|
   * | `priceRange.min`   | min `price` between active variants  | filtering products by price in search         |
   * | `priceRange.max`   | max `price` between active variants | filtering products by price in search         |
   * | `stockSummary`     | sum of `stock` for all variants        | displaying total inventory and system statistics    |
   * | `variantCount`     | number of active variants              | classifying products (single / multiple)        |
   *
   * ---
   * ## Mechanism of Action
   *
   * 1. The `variant.changed` event is triggered after the transaction completes.
   * 2. This listener is executed **asynchronously** `{ async: true }` (fire & forget)
   *    so as not to slow down the response to the user.
   * 3. `$match` is performed on non-deleted and active variants only.
   * 4. `$group` is performed to calculate min/max/sum/count in one go.
   * 5. Update the product with the results or put zeros if there are no variants.
   * 6. Any error is only logged without throwing an exception (because the transaction has already completed successfully).
   *
   * ---
   * @param event - carrying `productId` of the product whose statistics are to be updated.
   */
  @OnEvent('variant.changed', { async: true })
  async handleVariantChanged(event: VariantChangedEvent) {
    await this.syncProduct(event.productId);
  }

  /**
   * Recomputes the aggregates, then — only once they are final — clears the
   * backend response cache and expires the storefront ISR cache.
   *
   * Invalidating *after* the recompute matters: any read that raced in before
   * it (e.g. the dashboard refetching right after a save) may have cached the
   * pre-aggregation values (old stock/price) under its language key.
   *
   * Can be awaited directly (product create/update) or run via the event.
   * Never throws.
   */
  async syncProduct(productId: Types.ObjectId) {
    const event = { productId };
    try {
      const stats = await this.variantModel.aggregate<VariantStatsResult>([
        {
          $match: {
            productId: event.productId,
            isDeleted: { $ne: true },
            isActive: true,
          },
        },
        {
          $group: {
            _id: '$productId',
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            totalStock: { $sum: '$stock' },
            count: { $sum: 1 },
          },
        },
      ]);

      // If there are no active variants, the values are reset to zero
      const result: VariantStatsResult = stats[0] ?? {
        minPrice: 0,
        maxPrice: 0,
        totalStock: 0,
        count: 0,
      };

      const product = await this.productModel.findOneAndUpdate(
        { _id: event.productId },
        {
          $set: {
            'priceRange.min': result.minPrice,
            'priceRange.max': result.maxPrice,
            stockSummary: result.totalStock,
            variantCount: result.count,
          },
        },
        { projection: { slug: 1 } },
      );

      await this.cacheInvalidation.clearResources(['products']);
      await this.revalidationService.revalidate([
        'products',
        ...(product?.slug ? [`product-${product.slug}`] : []),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to sync aggregates for product ${event.productId.toString()}`,
        error,
      );
    }
  }
}
