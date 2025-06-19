import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Product } from 'src/products/shared/schemas/Product.schema';

type ValidatedItem = {
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
};

@Injectable()
export class ProductHelperService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}
  //   products = await this.productModel.find({ _id: { $in: itemIds } }).exec();

  async updateProductStats(validatedItems: ValidatedItem[]) {
    const bulkOptions = validatedItems.map((product) => {
      const newSold = (product.product.sold || 0) + product.quantity;
      let newQuantity = product.product.quantity - product.quantity;
      if (!product.product.SineLimit && newQuantity <= 0) {
        newQuantity = 0;
      }
      return {
        updateOne: {
          filter: { _id: product.product.id },
          update: {
            $set: {
              sold: newSold,
              quantity: newQuantity,
            },
          },
        },
      };
    });

    await this.productModel.bulkWrite(bulkOptions);
  }
}
