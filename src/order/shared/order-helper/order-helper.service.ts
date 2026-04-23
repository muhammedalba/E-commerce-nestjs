import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { I18nContext } from 'nestjs-i18n';

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
export class OrderHelperService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariantDocument>,
  ) {}

  private getCurrentLang(): string {
    return I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
  }

  /**
   * Validates order items by checking product + variant existence, stock, and pricing.
   * Items now require a variantId alongside productId.
   */
  async validateOrderItems(
    items: Array<{ productId: string; variantId: string; quantity: number }>,
  ): Promise<{
    validatedItems: ValidatedItem[];
    totalPrice: number;
    totalQuantity: number;
    updatedProducts: Array<{
      productId: string;
      variantId: string;
      availableStock: number;
      RequiredQuantity: number;
      title: string;
      sku: string;
    }>;
    unAvailableProducts: Array<{ productId: string; variantId?: string }>;
  }> {
    const validatedItems: ValidatedItem[] = [];
    const updatedProducts: Array<{
      productId: string;
      variantId: string;
      availableStock: number;
      RequiredQuantity: number;
      title: string;
      sku: string;
    }> = [];
    const unAvailableProducts: Array<{
      productId: string;
      variantId?: string;
    }> = [];
    let totalPrice = 0;
    let totalQuantity = 0;

    const lang = this.getCurrentLang();

    for (const item of items) {
      if (!Types.ObjectId.isValid(item.productId)) {
        throw new BadRequestException(`Invalid product ID: ${item.productId}`);
      }
      if (!Types.ObjectId.isValid(item.variantId)) {
        throw new BadRequestException(`Invalid variant ID: ${item.variantId}`);
      }

      // Fetch product
      const product = await this.productModel
        .findById(item.productId)
        .select('title isUnlimitedStock disabled brand category imageCover')
        .exec();

      if (!product || product.disabled) {
        unAvailableProducts.push({ productId: item.productId.toString() });
        continue;
      }

      // Fetch variant
      const variant = await this.variantModel
        .findOne({
          _id: item.variantId,
          productId: item.productId,
          isActive: true,
        })
        .lean();

      if (!variant) {
        unAvailableProducts.push({
          productId: item.productId.toString(),
          variantId: item.variantId.toString(),
        });
        continue;
      }

      const translatedTitle =
        typeof product.get(`title.${lang}`) === 'string'
          ? (product.get(`title.${lang}`) as string)
          : typeof product.title === 'string'
            ? product.title
            : product.title?.en || product.title?.ar || '';

      // Stock check (against variant, not product)
      if (!product.isUnlimitedStock && variant.stock < item.quantity) {
        updatedProducts.push({
          productId: product._id.toString(),
          variantId: variant._id.toString(),
          availableStock: variant.stock,
          RequiredQuantity: item.quantity,
          title: translatedTitle,
          sku: variant.sku,
        });
        continue;
      }

      const price = variant.priceAfterDiscount ?? variant.price;
      const itemTotal = price * item.quantity;

      validatedItems.push({
        product: {
          id: product._id,
          brand: product.brand?.toString() || '',
          category: product.category?.toString() || '',
          title: translatedTitle,
          imageCover: product.imageCover,
          isUnlimitedStock: product.isUnlimitedStock,
        },
        variant: {
          id: variant._id,
          price,
          stock: variant.stock,
          sold: variant.sold || 0,
          sku: variant.sku,
          attributes: variant.attributes || {},
        },
        quantity: item.quantity,
        totalPrice: itemTotal,
      });

      totalPrice += itemTotal;
      totalQuantity += item.quantity;
    }

    totalPrice = Math.round(totalPrice * 100) / 100;

    return {
      validatedItems,
      totalPrice,
      totalQuantity,
      updatedProducts,
      unAvailableProducts,
    };
  }
}
