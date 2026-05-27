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
import { CartItem } from './shared/schemas/cart-item.schema';
import { InventoryAlertService } from 'src/products/services/inventory-alert.service';
import { SettingsService } from 'src/settings/settings.service';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    @InjectModel(Product.name) private readonly ProductModel: Model<Product>,
    @InjectModel(ProductVariant.name)
    private readonly VariantModel: Model<ProductVariantDocument>,
    protected readonly i18n: CustomI18nService,
    private readonly inventoryAlertService: InventoryAlertService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Retrieves the user's shopping cart while performing a "Silent Sync".
   * * @description
   * This method fetches the cart and leverages the populated live product/variant data
   * to automatically synchronize prices and remove inactive items in the background
   * without interrupting the user checkout flow.
   * * @features
   * 1. Silent Price Sync: Updates snapshot `unitPrice` if admin changed live product prices.
   * 2. Silent Catalog Cleanup: Automatically drops items that were deleted or deactivated.
   * 3. Auto Stock Correction: Scales down quantity if requested items exceed available live stock.
   * * @param {string} userId - The unique identifier of the cart owner.
   * @returns {Promise<unknown>} The synchronized, localized, and clean cart object.
   */
  async getCart(userId: string): Promise<unknown> {
    // 1. Fetch the cart document (WITHOUT .lean() initially to allow mutation and .save())
    const cart = await this.cartModel
      .findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'title imageCover isActive isUnlimitedStock',
      })
      .populate({
        path: 'items.variant',
        select: 'sku price priceAfterDiscount stock attributes label',
      })
      .exec();

    // Return an empty structure if no cart exists yet
    if (!cart) {
      return { items: [] };
    }

    let isModified = false;
    let newTotalPrice = 0;
    let newTotalQuantity = 0;
    const updatedItems: CartItem[] = [];

    // 2. Iterate through items to check for live catalog changes
    for (const item of cart.items) {
      const product = item.product as unknown as Product;
      const variant = item.variant as unknown as ProductVariantDocument;

      // CRITICAL: If the product or variant no longer exists or was deactivated by admin
      if (!product || !product.isActive || !variant) {
        isModified = true;
        continue; // Silently drops the item from the cart array
      }

      // 3. Silent Price Sync Strategy
      const livePriceRaw = variant.priceAfterDiscount ?? variant.price;
      const livePrice = Number(livePriceRaw.toFixed(2));

      // If the price snapshot stored in the cart differs from the live database price
      if (item.unitPrice !== livePrice) {
        item.unitPrice = livePrice;
        isModified = true;
      }

      // 4. Silent Inventory Correction
      if (!product.isUnlimitedStock && variant.stock < item.quantity) {
        isModified = true;
        // فحص الإعداد قبل الإرسال — سلة فقط
        if (await this.settingsService.isInventoryAlertsEnabled()) {
          await this.inventoryAlertService.checkStockAndAlert(
            product as any,
            variant as any,
            item.quantity,
          );
        }
        if (variant.stock <= 0) {
          continue; // Remove from cart if completely out of stock
        } else {
          item.quantity = variant.stock; // Cap the quantity to maximum available stock
        }
      }

      // Accumulate the fresh sub-totals
      newTotalPrice += item.unitPrice * item.quantity;
      newTotalQuantity += item.quantity;

      updatedItems.push(item);
    }

    // 5. Persist changes to the database only if data drifted
    if (isModified) {
      cart.items = updatedItems;
      cart.totalPrice = Number(newTotalPrice.toFixed(2));
      cart.totalQuantity = newTotalQuantity;

      // Extra safeguard for a completely empty cart
      if (cart.items.length === 0) {
        cart.totalPrice = 0;
        cart.totalQuantity = 0;
      }

      await cart.save();
    }

    // 6. Convert Mongoose document to a plain object before applying localization
    const cleanCartObject = cart.toObject();

    return this.i18n.localize(cleanCartObject);
  }

  async addItem(userId: string, createCartDto: CreateCartDto) {
    const { productId, variantId, quantity } = createCartDto;

    // 1.check product is exist and active
    const product = await this.ProductModel.findById(productId)
      .select('isUnlimitedStock isActive title')
      .lean()
      .exec();

    if (!product || !product.isActive) {
      throw new BadRequestException('المنتج غير موجود أو غير نشط');
    }

    // 2. get the variant
    const variant = await this.VariantModel.findOne({
      _id: variantId,
      productId,
      isActive: true,
    })
      .select('price priceAfterDiscount stock')
      .lean()
      .exec();

    if (!variant) {
      throw new BadRequestException('المتغير غير موجود');
    }

    // 3. initial stock check
    if (!product.isUnlimitedStock && variant.stock < quantity) {
      if (await this.settingsService.isInventoryAlertsEnabled()) {
        await this.inventoryAlertService.checkStockAndAlert(
          product as any,
          variant as any,
          quantity,
        );
      }
      throw new BadRequestException(
        'الكمية المطلوبة غير متوفرة في المخزون حالياً',
      );
    }

    // 3. calculations
    const rawPrice = variant.priceAfterDiscount ?? variant.price;
    const price = Number(rawPrice.toFixed(2));
    const itemTotal = Number((price * quantity).toFixed(2));

    let retries = 3;
    while (retries >= 0) {
      try {
        let cart = await this.cartModel.findOne({ user: userId });

        if (!cart) {
          // create new cart
          cart = new this.cartModel({
            user: userId,
            items: [
              {
                product: new Types.ObjectId(productId),
                variant: new Types.ObjectId(variantId),
                quantity,
                unitPrice: price, // Price Snapshot
              },
            ],
            totalPrice: itemTotal,
            totalQuantity: quantity,
            isCheckedOut: false,
          });
        } else {
          // find existing item
          const existingItem = cart.items.find(
            (item) =>
              item.product.toString() === productId.toString() &&
              item.variant.toString() === variantId.toString(),
          );

          if (existingItem) {
            const newTotalQty = existingItem.quantity + quantity;
            // check new total quantity
            if (!product.isUnlimitedStock && variant.stock < newTotalQty) {
              if (await this.settingsService.isInventoryAlertsEnabled()) {
                await this.inventoryAlertService.checkStockAndAlert(
                  product as any,
                  variant as any,
                  newTotalQty,
                );
              }
              throw new BadRequestException(
                'الكمية الإجمالية تتخطى المخزون المتوفر',
              );
            }
            existingItem.quantity = newTotalQty;
          } else {
            // add new item with price snapshot
            cart.items.push({
              product: new Types.ObjectId(productId),
              variant: new Types.ObjectId(variantId),
              quantity,
              unitPrice: price, // Price Snapshot
            });
          }

          // update totals
          cart.totalPrice = Number((cart.totalPrice + itemTotal).toFixed(2));
          cart.totalQuantity += quantity;
        }
        // save cart
        await cart.save();
        return {
          totalPrice: cart.totalPrice,
          totalQuantity: cart.totalQuantity,
        };
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.name === 'VersionError' &&
          retries > 0
        ) {
          retries--;
          continue;
        }
        throw error;
      }
    }
  }

  async updateQuantity(userId: string, updateCartDto: CreateCartDto) {
    const { productId, variantId, quantity } = updateCartDto;

    let retries = 3;
    while (retries >= 0) {
      try {
        // find the cart
        const cart = await this.cartModel.findOne({ user: userId });
        if (!cart) throw new BadRequestException('السلة غير موجودة');

        // find the product
        const product = await this.ProductModel.findById(productId)
          .select('isUnlimitedStock isActive title')
          .lean()
          .exec();

        // find the variant (still needed for stock check)
        const variant = await this.VariantModel.findOne({
          _id: variantId,
          productId,
        }).lean();

        // check product and variant is exist
        if (!product || !variant || !product.isActive) {
          throw new BadRequestException('المنتج أو المتغير غير موجود');
        }

        // check stock
        if (!product.isUnlimitedStock && variant.stock < quantity) {
          if (await this.settingsService.isInventoryAlertsEnabled()) {
            await this.inventoryAlertService.checkStockAndAlert(
              product as any,
              variant as any,
              quantity,
            );
          }
          throw new BadRequestException(
            'الكمية المطلوبة تتخطى المخزون المتوفر',
          );
        }

        const existingItem = cart.items.find(
          (item) =>
            item.product.toString() === productId &&
            item.variant.toString() === variantId,
        );

        if (!existingItem) {
          throw new BadRequestException('المنتج غير موجود في السلة');
        }

        // Use the stored unitPrice snapshot — no extra DB query needed
        const price = existingItem.unitPrice;

        const oldItemTotal = Number((price * existingItem.quantity).toFixed(2));
        const newItemTotal = Number((price * quantity).toFixed(2));

        cart.totalPrice = Number(
          (cart.totalPrice - oldItemTotal + newItemTotal).toFixed(2),
        );
        cart.totalQuantity =
          cart.totalQuantity - existingItem.quantity + quantity;

        existingItem.quantity = quantity;
        // save the cart
        await cart.save();
        return {
          totalPrice: cart.totalPrice,
          totalQuantity: cart.totalQuantity,
        };
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.name === 'VersionError' &&
          retries > 0
        ) {
          retries--;
          continue;
        }
        throw error;
      }
    }
  }

  async removeItem(userId: string, productId: string, variantId?: string) {
    let retries = 3;
    while (retries >= 0) {
      try {
        const cart = await this.cartModel.findOne({ user: userId });

        if (!cart) return { items: [] };
        // remove if variantId is provided
        const itemsToRemove = cart.items.filter((item) => {
          if (variantId) {
            return (
              item.product.toString() === productId &&
              item.variant.toString() === variantId
            );
          }
          return item.product.toString() === productId;
        });
        // if the product not found in cart return the cart
        if (itemsToRemove.length === 0) {
          return await cart
            .populate('items.product')
            .then((c) => c.populate('items.variant'));
        }

        let priceToSubtract = 0;
        let qtyToSubtract = 0;

        // Price Snapshot: no DB query needed — unitPrice is stored on each item
        for (const item of itemsToRemove) {
          priceToSubtract += item.unitPrice * item.quantity;
          qtyToSubtract += item.quantity;
        }

        cart.items = cart.items.filter((item) => {
          if (variantId) {
            return !(
              item.product.toString() === productId &&
              item.variant.toString() === variantId
            );
          }
          return item.product.toString() !== productId;
        });

        cart.totalPrice = Number(
          (cart.totalPrice - priceToSubtract).toFixed(2),
        );
        cart.totalQuantity -= qtyToSubtract;

        if (cart.items.length === 0) {
          cart.totalPrice = 0;
          cart.totalQuantity = 0;
        } else {
          if (cart.totalPrice < 0) cart.totalPrice = 0;
          if (cart.totalQuantity < 0) cart.totalQuantity = 0;
        }

        await cart.save();
        return await cart
          .populate('items.product')
          .then((c) => c.populate('items.variant'));
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.name === 'VersionError' &&
          retries > 0
        ) {
          retries--;
          continue;
        }
        throw error;
      }
    }
  }

  async clearCart(userId: string) {
    const cart = await this.cartModel.findOne({ user: userId });

    if (!cart) return { items: [] };

    cart.items = [];
    cart.totalPrice = 0;
    cart.totalQuantity = 0;
    await cart.save();

    return { items: [] };
  }

  async syncCart(userId: string, items: CreateCartDto[]) {
    if (!items || items.length === 0) return this.getCart(userId);

    for (const item of items) {
      try {
        await this.addItem(userId, item);
      } catch (error) {
        console.error('Failed to sync cart item:', item, error);
      }
    }
    return this.getCart(userId);
  }
}
