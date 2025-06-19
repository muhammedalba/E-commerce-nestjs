import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { I18nContext } from 'nestjs-i18n';

import { Product } from 'src/products/shared/schemas/Product.schema';

type validatedItems = {
  product: {
    id: Types.ObjectId;
    imageCover: string;
    brand: string;
    category: string;
    title: string;
    price: number;
    quantity: number;
    sold: number;
    SineLimit?: boolean;
  };
  quantity: number;
  totalPrice?: number;
}[];
// type validatedItems = ValidatedItem;
@Injectable()
export class OrderHelperService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}
  //
  private getCurrentLang(): string {
    const lang =
      I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    return lang;
  }
  //
  async validateOrderItems(
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<{
    validatedItems: validatedItems;
    totalPrice: number;
    totalQuantity: number;
    updatedProducts: Array<{
      productId: string;
      availableQuantity: number;
      RequiredQuantity: number;
      title: string;
    }>;
    unAvailableProducts: Array<{ productId: string }>;
  }> {
    const validatedItems: validatedItems = [];
    const updatedProducts: Array<{
      productId: string;
      availableQuantity: number;
      RequiredQuantity: number;
      title: string;
    }> = [];

    const unAvailableProducts: Array<{ productId: string }> = [];
    let totalPrice = 0;
    let totalQuantity = 0;

    const lang = this.getCurrentLang();

    for (const item of items) {
      if (!Types.ObjectId.isValid(item.productId)) {
        throw new BadRequestException(`Invalid product ID: ${item.productId}`);
      }

      const product = await this.productModel
        .findById(item.productId)
        .select(
          'title price priceAfterDiscount SineLimit quantity sold disabled SineLimit brand category imageCover',
        )
        .exec();

      if (!product || product.disabled) {
        unAvailableProducts.push({ productId: item.productId.toString() });
        continue;
      }
      const translatedTitle =
        typeof product.get(`title.${lang}`) === 'string'
          ? (product.get(`title.${lang}`) as string)
          : product.title;

      if (!product.SineLimit && product.quantity < item.quantity) {
        updatedProducts.push({
          productId: product._id.toString(),
          availableQuantity: product.quantity,
          RequiredQuantity: item.quantity,
          title: translatedTitle,
        });
        continue;
      }

      const price = product.priceAfterDiscount ?? product.price;
      const itemTotal = price * item.quantity;

      validatedItems.push({
        product: {
          id: product._id,
          brand: product.brand?.toString() || '',
          category: product.category?.toString() || '',
          title: translatedTitle,
          price,
          quantity: product.quantity,
          sold: product.sold || 0,
          imageCover: product.imageCover,
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
