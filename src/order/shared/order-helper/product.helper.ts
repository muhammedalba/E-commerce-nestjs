import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from 'src/products/shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from 'src/products/shared/schemas/ProductVariant.schema';

type ValidatedItem = {
  product: {
    id: Types.ObjectId;
    imageCover: string;
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
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariantDocument>,
  ) {}

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
