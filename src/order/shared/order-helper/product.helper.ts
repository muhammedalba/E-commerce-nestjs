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
}
