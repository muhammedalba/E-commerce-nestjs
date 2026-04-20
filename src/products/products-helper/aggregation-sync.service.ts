import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from '../shared/schemas/ProductVariant.schema';
import { OnEvent } from '@nestjs/event-emitter';

export class VariantChangedEvent {
  constructor(public readonly productId: Types.ObjectId) {}
}

@Injectable()
export class AggregationSyncService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariantDocument>,
  ) {}

  /**
   * Async event listener that recalculates product aggregates out-of-band.
   * Fired AFTER a variant transaction is committed.
   */
  @OnEvent('variant.changed', { async: true })
  async handleVariantChanged(event: VariantChangedEvent) {
    try {
      const stats = await this.variantModel.aggregate([
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

      const result = stats[0] || {
        minPrice: 0,
        maxPrice: 0,
        totalStock: 0,
        count: 0,
      };

      await this.productModel.updateOne(
        { _id: event.productId },
        {
          $set: {
            'priceRange.min': result.minPrice,
            'priceRange.max': result.maxPrice,
            stockSummary: result.totalStock,
            variantCount: result.count,
          },
        },
      );
    } catch (error) {
      console.error(
        `[AggregationSyncWorker] Failed to sync aggregates for product ${event.productId}:`,
        error,
      );
    }
  }
}
