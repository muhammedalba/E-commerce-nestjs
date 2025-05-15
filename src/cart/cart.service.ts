import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart } from './shared/schemas/cart.schema';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
  ) {}

  async getCart(userId: string) {
    const cart = await this.cartModel
      .findOne({ user: userId })
      .populate('items.product');

    if (!cart) {
      return { items: [] };
    }

    return cart;
  }

  async addItem(userId: string, productId: string, quantity: number) {
    let cart = await this.cartModel.findOne({ user: userId });

    if (!cart) {
      cart = new this.cartModel({
        user: userId,
        items: [{ product: productId, quantity }],
      });
    } else {
      const existingItem = cart.items.find(
        (item) => item.product.toString() === productId,
      );

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ product: new Types.ObjectId(productId), quantity });
      }
    }

    await cart.save();
    return cart.populate('items.product');
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.cartModel.findOne({ user: userId });

    if (!cart) return { items: [] };

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId,
    );

    await cart.save();
    return cart.populate('items.product');
  }

  async clearCart(userId: string) {
    const cart = await this.cartModel.findOne({ user: userId });

    if (!cart) return { items: [] };

    cart.items = [];
    await cart.save();

    return cart;
  }
}
