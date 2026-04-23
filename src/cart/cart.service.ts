import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart } from './shared/schemas/cart.schema';
import { CreateCartDto } from './shared/dto/create-cart.dto';
import { Product } from 'src/products/shared/schemas/Product.schema';
import {
  ProductVariant,
  ProductVariantDocument,
} from 'src/products/shared/schemas/ProductVariant.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    @InjectModel(Product.name) private readonly ProductModel: Model<Product>,
    @InjectModel(ProductVariant.name)
    private readonly VariantModel: Model<ProductVariantDocument>,
    protected readonly i18n: CustomI18nService,
  ) {}

  async getCart(userId: string) {
    const cart = await this.cartModel
      .findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'title imageCover',
      })
      .populate({
        path: 'items.variant',
        select: 'sku price priceAfterDiscount stock attributes label',
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
    const { productId, variantId, quantity } = createCartDto;

    // 1. Check if product and variant exist
    let cart = await this.cartModel.findOne({ user: userId });

    const product = await this.ProductModel.findById(productId)
      .select('isUnlimitedStock disabled')
      .lean()
      .exec();

    if (!product || product.disabled) {
      throw new BadRequestException('Ø§Ù„Ù…Ù†ØªØ¬ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯');
    }

    // 2. Fetch variant and check stock
    const variant = await this.VariantModel.findOne({
      _id: variantId,
      productId,
      isActive: true,
    })
      .select('price priceAfterDiscount stock')
      .lean()
      .exec();

    if (!variant) {
      throw new BadRequestException('Ø§Ù„Ù…ØªØºÙŠØ± ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯');
    }

    // 3. Check stock at variant level
    if (!product.isUnlimitedStock && variant.stock < quantity) {
      throw new BadRequestException('Ø§Ù„ÙƒÙ…ÙŠØ© ØºÙŠØ± Ù…ØªÙˆÙØ±Ø©');
    }

    // 4. Calculate price from variant
    const rawPrice = variant.priceAfterDiscount ?? variant.price;
    const price = Number(rawPrice.toFixed(2));
    const itemTotal = Number((price * quantity).toFixed(2));

    // 5. Create or update cart
    if (!cart) {
      cart = new this.cartModel({
        user: userId,
        items: [
          {
            product: productId,
            variant: variantId,
            quantity,
          },
        ],
        totalPrice: itemTotal,
        totalQuantity: quantity,
        isCheckedOut: false,
      });
    } else {
      // 6. Check if product+variant combo already in cart
      const existingItem = cart.items.find(
        (item) =>
          item.product.toString() === productId.toString() &&
          item.variant.toString() === variantId.toString(),
      );

      if (existingItem) {
        const newTotalQty = existingItem.quantity + quantity;
        if (!product.isUnlimitedStock && variant.stock < newTotalQty) {
          throw new BadRequestException('Ø§Ù„ÙƒÙ…ÙŠØ© ØºÙŠØ± ÙƒØ§ÙÙŠØ©');
        }
        existingItem.quantity = newTotalQty;
      } else {
        cart.items.push({
          product: new Types.ObjectId(productId),
          variant: new Types.ObjectId(variantId),
          quantity,
        });
      }

      cart.totalPrice = Number((cart.totalPrice + itemTotal).toFixed(2));
      cart.totalQuantity += quantity;
    }

    await cart.save();
    return {
      status: 'success',
      message: this.i18n.translate('success.created_SUCCESS'),
      totalPrice: cart.totalPrice,
      totalQuantity: cart.totalQuantity,
    };
  }

  async removeItem(userId: string, productId: string, variantId?: string) {
    const cart = await this.cartModel.findOne({ user: userId });

    if (!cart) return { items: [] };

    cart.items = cart.items.filter((item) => {
      if (variantId) {
        return !(
          item.product.toString() === productId &&
          item.variant.toString() === variantId
        );
      }
      return item.product.toString() !== productId;
    });

    await cart.save();
    return cart
      .populate('items.product')
      .then((c) => c.populate('items.variant'));
  }

  async clearCart(userId: string) {
    const cart = await this.cartModel.findOne({ user: userId });

    if (!cart) return { items: [] };

    cart.items = [];
    await cart.save();

    return cart;
  }
}
