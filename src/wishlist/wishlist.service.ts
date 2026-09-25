import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wishlist } from './shared/schemas/wishlist.schema';
import { Product } from 'src/products/shared/schemas/Product.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { WISHLIST_MAX_ITEMS } from './shared/constants/wishlist.constants';

/** Only products that are still sellable are shown / accepted. */
const AVAILABLE_PRODUCT_FILTER = { isActive: true, isDeleted: { $ne: true } };

/** Fields needed by the storefront ProductCard. */
const PRODUCT_CARD_FIELDS =
  'title slug sku description uses imageCover priceRange variantCount stockSummary isUnlimitedStock isFeatured ratingsAverage ratingsQuantity';

@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(Wishlist.name)
    private readonly wishlistModel: Model<Wishlist>,
    @InjectModel(Product.name) private readonly ProductModel: Model<Product>,
    protected readonly i18n: CustomI18nService,
  ) {}

  /** Newest first: `$addToSet` appends, so the stored array is oldest → newest. */
  private toIds(products: Types.ObjectId[]): string[] {
    return products.map(String).reverse();
  }

  /**
   * Silent Catalog Cleanup: drops wishlist entries whose product was deleted
   * or deactivated, then returns the still-available product IDs.
   */
  private async pruneUnavailable(
    userId: string,
    storedIds: Types.ObjectId[],
    availableIds: Set<string>,
  ) {
    const staleIds = storedIds.filter((id) => !availableIds.has(String(id)));
    if (staleIds.length > 0) {
      await this.wishlistModel.updateOne(
        { user: userId },
        { $pullAll: { products: staleIds } },
      );
    }
    return storedIds.filter((id) => availableIds.has(String(id)));
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET WISHLIST  ====== ---------- //
  // ------------ =============================== ---------- //
  async getWishlist(userId: string) {
    const wishlist = await this.wishlistModel
      .findOne({ user: userId })
      .lean()
      .exec();

    if (!wishlist || wishlist.products.length === 0) {
      return { products: [], count: 0 };
    }

    const products = await this.ProductModel.find({
      _id: { $in: wishlist.products },
      ...AVAILABLE_PRODUCT_FILTER,
    })
      .select(PRODUCT_CARD_FIELDS)
      .populate({
        path: 'variants',
        select: 'sku price priceAfterDiscount stock attributes label',
      })
      .exec();

    const productsById = new Map(products.map((p) => [String(p._id), p]));
    const availableIds = await this.pruneUnavailable(
      userId,
      wishlist.products,
      new Set(productsById.keys()),
    );

    const ordered = this.toIds(availableIds).map((id) =>
      productsById.get(id)!.toObject(),
    );

    return this.i18n.localize({ products: ordered, count: ordered.length });
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET IDS  ====== ---------- //
  // ------------ =============================== ---------- //
  /** Lightweight endpoint used by the UI to paint the heart state on product cards. */
  async getIds(userId: string) {
    const wishlist = await this.wishlistModel
      .findOne({ user: userId })
      .lean()
      .exec();

    if (!wishlist || wishlist.products.length === 0) {
      return { productIds: [] };
    }

    const available = await this.ProductModel.find({
      _id: { $in: wishlist.products },
      ...AVAILABLE_PRODUCT_FILTER,
    })
      .select('_id')
      .lean()
      .exec();

    const availableIds = await this.pruneUnavailable(
      userId,
      wishlist.products,
      new Set(available.map((p) => String(p._id))),
    );

    return { productIds: this.toIds(availableIds) };
  }

  // ------------ =============================== ---------- //
  // ------------ ======  ADD ITEM  ====== ---------- //
  // ------------ =============================== ---------- //
  async addItem(userId: string, productId: string) {
    const product = await this.ProductModel.exists({
      _id: productId,
      ...AVAILABLE_PRODUCT_FILTER,
    });
    if (!product) {
      throw new BadRequestException(
        this.i18n.translate('exception.wishlist.PRODUCT_NOT_AVAILABLE'),
      );
    }

    const existing = await this.wishlistModel
      .findOne({ user: userId })
      .select('products')
      .lean()
      .exec();
    const alreadyIn = existing?.products.some((id) => String(id) === productId);
    if (!alreadyIn && (existing?.products.length ?? 0) >= WISHLIST_MAX_ITEMS) {
      throw new BadRequestException(
        this.i18n.translate('exception.wishlist.LIMIT_REACHED'),
      );
    }

    const wishlist = await this.wishlistModel
      .findOneAndUpdate(
        { user: userId },
        { $addToSet: { products: new Types.ObjectId(productId) } },
        { new: true, upsert: true },
      )
      .lean()
      .exec();

    return { productIds: this.toIds(wishlist.products) };
  }

  // ------------ =============================== ---------- //
  // ------------ ======  REMOVE ITEM  ====== ---------- //
  // ------------ =============================== ---------- //
  async removeItem(userId: string, productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException(
        this.i18n.translate('exception.wishlist.PRODUCT_NOT_AVAILABLE'),
      );
    }

    const wishlist = await this.wishlistModel
      .findOneAndUpdate(
        { user: userId },
        { $pull: { products: new Types.ObjectId(productId) } },
        { new: true },
      )
      .lean()
      .exec();

    return { productIds: wishlist ? this.toIds(wishlist.products) : [] };
  }

  // ------------ =============================== ---------- //
  // ------------ ======  CLEAR  ====== ---------- //
  // ------------ =============================== ---------- //
  async clear(userId: string) {
    await this.wishlistModel.updateOne(
      { user: userId },
      { $set: { products: [] } },
    );
    return { productIds: [] };
  }

  // ------------ =============================== ---------- //
  // ------------ ======  SYNC WISHLIST  ====== ---------- //
  // ------------ =============================== ---------- //
  /**
   * Merges the guest wishlist (localStorage) into the user's wishlist in a single write.
   * - Unknown / inactive products are silently dropped (stale localStorage data).
   * - `$addToSet` makes the merge idempotent (no duplicates, safe to retry).
   * - Respects WISHLIST_MAX_ITEMS by keeping only as many new items as there is room for.
   */
  async sync(userId: string, productIds: string[]) {
    const uniqueIds = [...new Set(productIds)];
    if (uniqueIds.length === 0) return this.getIds(userId);

    const [available, existing] = await Promise.all([
      this.ProductModel.find({
        _id: { $in: uniqueIds },
        ...AVAILABLE_PRODUCT_FILTER,
      })
        .select('_id')
        .lean()
        .exec(),
      this.wishlistModel
        .findOne({ user: userId })
        .select('products')
        .lean()
        .exec(),
    ]);

    const availableSet = new Set(available.map((p) => String(p._id)));
    const existingSet = new Set((existing?.products ?? []).map(String));
    const room = WISHLIST_MAX_ITEMS - existingSet.size;

    // Keep the guest's insertion order (oldest → newest)
    const toAdd = uniqueIds
      .filter((id) => availableSet.has(id) && !existingSet.has(id))
      .slice(0, Math.max(room, 0))
      .map((id) => new Types.ObjectId(id));

    if (toAdd.length > 0) {
      await this.wishlistModel.updateOne(
        { user: userId },
        { $addToSet: { products: { $each: toAdd } } },
        { upsert: true },
      );
    }

    return this.getIds(userId);
  }
}
