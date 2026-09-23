import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, ClientSession, Model, Types } from 'mongoose';
import { Product } from 'src/products/shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from 'src/products/shared/schemas/ProductVariant.schema';

import { FileAsset } from 'src/shared/schema/file-asset.schema';
import { AggregationSyncService } from 'src/products/products-helper/aggregation-sync.service';

/** Minimal order line needed to give stock back (as stored on the Order). */
type OrderLine = {
  productId: Types.ObjectId | string;
  variantId: Types.ObjectId | string;
  quantity: number;
};

/** Thrown inside a transaction when an order line can't be taken; aborts it. */
export class StockShortageError extends Error {
  constructor(
    readonly shortage: {
      variantId: string;
      sku?: string;
      requested: number;
      available: number;
    },
  ) {
    super(`Insufficient stock for variant ${shortage.variantId}`);
  }
}

type ValidatedItem = {
  product: {
    id: Types.ObjectId;
    imageCover: FileAsset;
    brand: string;
    category: string;
    title: string;
    isUnlimitedStock?: boolean;
  };
  variant: {
    id: Types.ObjectId;
    price: number;
    stock: number;
    sold: number;
    sku: string;
    attributes: Record<string, unknown>;
  };
  quantity: number;
  totalPrice?: number;
};

@Injectable()
export class ProductHelperService {
  private readonly logger = new Logger(ProductHelperService.name);

  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariantDocument>,
    private readonly aggregationSync: AggregationSyncService,
  ) {}

  /**
   * After a stock/sold change: recomputes each product's aggregates
   * (`stockSummary`, `priceRange`), then clears the backend response cache and
   * expires the storefront ISR cache (AggregationSyncService.syncProduct).
   *
   * Awaited, so an order-status response is only sent once product reads are
   * fresh — the dashboard's immediate refetch no longer gets stale stock.
   * Never throws. (`reserved` changes skip this — nothing displayed uses it.)
   */
  private revalidateOrderedProducts(validatedItems: ValidatedItem[]) {
    return this.afterStockChange(validatedItems.map((item) => item.product.id));
  }

  async afterStockChange(ids: (Types.ObjectId | string)[]): Promise<void> {
    const productIds = [...new Set(ids.map(String))];
    await Promise.all(
      productIds.map((id) =>
        this.aggregationSync.syncProduct(new Types.ObjectId(id)),
      ),
    );
  }

  /**
   * Updates variant stock and sold counts after an order.
   * Stock is decremented per variant, not at product level.
   */
  async updateProductStats(validatedItems: ValidatedItem[]) {
    const bulkOptions = validatedItems.map((item) => {
      const newSold = (item.variant.sold || 0) + item.quantity;
      let newStock = item.variant.stock;

      // Only decrement stock if product is NOT unlimited
      if (!item.product.isUnlimitedStock) {
        newStock = Math.max(0, item.variant.stock - item.quantity);
      }

      return {
        updateOne: {
          filter: { _id: item.variant.id },
          update: {
            $set: {
              sold: newSold,
              stock: newStock,
            },
          },
        },
      };
    });

    await this.variantModel.bulkWrite(bulkOptions);
    await this.revalidateOrderedProducts(validatedItems);
  }

  /**
   * Reverts variant stock and sold counts after a failed order (Compensating action).
   */
  async revertProductStats(validatedItems: ValidatedItem[]) {
    const bulkOptions = validatedItems.map((item) => {
      const newSold = Math.max(0, (item.variant.sold || 0) - item.quantity);
      let newStock = item.variant.stock;

      // Only increment stock if product is NOT unlimited
      if (!item.product.isUnlimitedStock) {
        newStock = item.variant.stock + item.quantity;
      }

      return {
        updateOne: {
          filter: { _id: item.variant.id },
          update: {
            $set: {
              sold: newSold,
              stock: newStock,
            },
          },
        },
      };
    });

    await this.variantModel.bulkWrite(bulkOptions);
    await this.revalidateOrderedProducts(validatedItems);
  }

  /**
   * Gives stock back for a cancelled order, using the lines stored on the order
   * (not re-validated items: a cancelled product may now be inactive/out of stock).
   *
   * - `deducted`: stock was already taken (order.created / paid Moyasar):
   *   stock += qty (limited products only), sold -= qty.
   * - `reserved`: unpaid Moyasar order, stock was only reserved: reserved -= qty.
   *
   * Uses atomic pipeline updates (no read-modify-write), clamped at 0.
   */
  async restockOrderItems(items: OrderLine[], mode: 'deducted' | 'reserved') {
    if (items.length === 0) return;

    const products = await this.productModel
      .find({ _id: { $in: items.map((i) => i.productId) } })
      .select('isUnlimitedStock')
      .lean();
    const unlimited = new Set(
      products.filter((p) => p.isUnlimitedStock).map((p) => String(p._id)),
    );

    const bulkOptions: AnyBulkWriteOperation<ProductVariantDocument>[] = [];
    for (const item of items) {
      const qty = item.quantity;
      const isUnlimited = unlimited.has(String(item.productId));

      if (mode === 'reserved') {
        // reserveStock() only reserves for limited products
        if (isUnlimited) continue;
        bulkOptions.push({
          updateOne: {
            filter: { _id: item.variantId },
            update: [
              {
                $set: {
                  reserved: {
                    $max: [
                      0,
                      { $subtract: [{ $ifNull: ['$reserved', 0] }, qty] },
                    ],
                  },
                },
              },
            ],
          },
        });
        continue;
      }

      bulkOptions.push({
        updateOne: {
          filter: { _id: item.variantId },
          update: [
            {
              $set: {
                ...(isUnlimited ? {} : { stock: { $add: ['$stock', qty] } }),
                sold: {
                  $max: [0, { $subtract: [{ $ifNull: ['$sold', 0] }, qty] }],
                },
              },
            },
          ],
        },
      });
    }

    if (bulkOptions.length > 0) {
      await this.variantModel.bulkWrite(bulkOptions);
    }
    if (mode === 'deducted') {
      await this.afterStockChange(items.map((i) => i.productId));
    }
  }

  /**
   * Takes stock again when a cancelled/expired order is reactivated
   * (inverse of {@link restockOrderItems}). Must run inside a transaction.
   *
   * Each limited line is taken with a conditional atomic update
   * (`stock - reserved >= qty`). If any line is short, throws
   * {@link StockShortageError}: aborting the transaction undoes every line
   * already taken (and the caller's status change) — nothing stays deducted.
   *
   * Side effects (aggregate sync / ISR) are NOT fired here: the caller runs
   * {@link afterStockChange} once the transaction has committed.
   */
  async deductOrderItems(
    items: OrderLine[],
    mode: 'deducted' | 'reserved',
    session: ClientSession,
  ): Promise<void> {
    if (items.length === 0) return;

    const products = await this.productModel
      .find({ _id: { $in: items.map((i) => i.productId) } })
      .select('isUnlimitedStock')
      .session(session)
      .lean();
    const unlimited = new Set(
      products.filter((p) => p.isUnlimitedStock).map((p) => String(p._id)),
    );

    for (const item of items) {
      const qty = item.quantity;

      // Unlimited: no stock to check; reserved mode never reserved them
      if (unlimited.has(String(item.productId))) {
        if (mode === 'deducted') {
          await this.variantModel.updateOne(
            { _id: item.variantId },
            { $inc: { sold: qty } },
            { session },
          );
        }
        continue;
      }

      const result = await this.variantModel.updateOne(
        {
          _id: item.variantId,
          $expr: {
            $gte: [
              { $subtract: ['$stock', { $ifNull: ['$reserved', 0] }] },
              qty,
            ],
          },
        },
        {
          $inc:
            mode === 'deducted'
              ? { stock: -qty, sold: qty }
              : { reserved: qty },
        },
        { session },
      );

      if (result.modifiedCount === 0) {
        const variant = await this.variantModel
          .findById(item.variantId)
          .select('sku stock reserved')
          .session(session)
          .lean();
        throw new StockShortageError({
          variantId: String(item.variantId),
          sku: variant?.sku,
          requested: qty,
          available: variant
            ? Math.max(0, variant.stock - (variant.reserved || 0))
            : 0,
        });
      }
    }
  }

  /**
   * Moyasar only: reserves stock without deducting it.
   * stock unchanged, reserved += qty
   */
  async reserveStock(validatedItems: ValidatedItem[]) {
    const bulkOptions = validatedItems.map((item) => {
      let reservedInc = 0;
      if (!item.product.isUnlimitedStock) {
        reservedInc = item.quantity;
      }
      return {
        updateOne: {
          filter: { _id: item.variant.id },
          update: {
            $inc: { reserved: reservedInc },
          },
        },
      };
    });
    if (bulkOptions.length > 0) {
      await this.variantModel.bulkWrite(bulkOptions);
    }
  }

  /**
   * Moyasar only: confirms a payment — finalizes the reservation.
   * stock -= qty, sold += qty, reserved -= qty (atomic bulkWrite)
   */
  async confirmReservation(validatedItems: ValidatedItem[]) {
    const bulkOptions = validatedItems.map((item) => {
      let stockInc = 0;
      let reservedInc = 0;
      if (!item.product.isUnlimitedStock) {
        stockInc = -item.quantity;
        reservedInc = -item.quantity;
      }
      return {
        updateOne: {
          filter: { _id: item.variant.id },
          update: {
            $inc: {
              stock: stockInc,
              reserved: reservedInc,
              sold: item.quantity,
            },
          },
        },
      };
    });
    if (bulkOptions.length > 0) {
      await this.variantModel.bulkWrite(bulkOptions);
      await this.revalidateOrderedProducts(validatedItems);
    }
  }

  /**
   * Moyasar only: releases a reservation (payment failed or expired).
   * reserved -= qty
   */
  async releaseReservation(validatedItems: ValidatedItem[]) {
    const bulkOptions = validatedItems.map((item) => {
      let reservedInc = 0;
      if (!item.product.isUnlimitedStock) {
        reservedInc = -item.quantity;
      }
      return {
        updateOne: {
          filter: { _id: item.variant.id },
          update: {
            $inc: { reserved: reservedInc },
          },
        },
      };
    });
    if (bulkOptions.length > 0) {
      await this.variantModel.bulkWrite(bulkOptions);
    }
  }
}
