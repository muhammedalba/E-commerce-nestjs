import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart } from './shared/schemas/cart.schema';
import { CreateCartDto } from './shared/dto/create-cart.dto';
import { Product } from 'src/products/shared/schemas/Product.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    @InjectModel(Product.name) private readonly ProductModel: Model<Product>,
    protected readonly i18n: CustomI18nService,
  ) {}

  async getCart(userId: string) {
    const cart = await this.cartModel
      .findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'name price priceAfterDiscount imageCover', // أو أي حقل تريده
      })
      .lean()
      .exec();

    if (!cart) {
      return { items: [] };
    }

    return {
      success: 'success',
      message: this.i18n.translate('success.found_SUCCESS'),
      data: cart,
    };
  }

  async addItem(userId: string, createCartDto: CreateCartDto) {
    const { productId, quantity } = createCartDto;
    // 1.check if the user has a cart
    let cart = await this.cartModel.findOne({ user: userId });
    // 2.check if the product exists
    const product = await this.ProductModel.findById(productId)
      .select('quantity price isUnlimitedStock  priceAfterDiscount')
      .lean()
      .exec();

    if (!product) {
      throw new BadRequestException('المنتج غير موجود');
    }

    // 3.check if the quantity is valid
    if (!product.isUnlimitedStock && product.quantity < quantity) {
      throw new BadRequestException('الكمية غير متوفرة');
    }

    // 4.calculate the total price for the item
    const rawPrice = product.priceAfterDiscount ?? product.price;
    const price = Number(rawPrice.toFixed(2));
    const itemTotal = Number((price * quantity).toFixed(2));
    // 5.if the cart does not exist, create a new one
    if (!cart) {
      cart = new this.cartModel({
        user: userId,
        items: [{ product: productId, quantity }],
        totalPrice: itemTotal,
        totalQuantity: quantity,
        isCheckedOut: false,
      });
    } else {
      // 6.check if the product already exists in the cart
      const existingItem = cart.items.find(
        (item) => item.product.toString() === productId.toString(),
      );

      if (existingItem) {
        // 6.1 if the product exists, update the quantity and total price
        const newTotalQty = existingItem.quantity + quantity;
        if (!product.isUnlimitedStock && product.quantity < newTotalQty) {
          throw new BadRequestException('الكمية غير كافية');
        }

        existingItem.quantity = newTotalQty;
      } else {
        // 6.2 if the product does not exist, add it to the cart
        cart.items.push({
          product: new Types.ObjectId(productId),
          quantity,
        });
      }

      // 7.modify the total price and quantity of the cart
      cart.totalPrice = Number((cart.totalPrice + itemTotal).toFixed(2));
      cart.totalQuantity += quantity;
    }

    // 8. Save the cart
    await cart.save();
    return {
      status: 'success',
      message: this.i18n.translate('success.created_SUCCESS'),
      totalPrice: cart.totalPrice,
      totalQuantity: cart.totalQuantity,
    };
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
