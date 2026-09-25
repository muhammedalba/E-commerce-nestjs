import { ArrayMaxSize, IsArray, IsMongoId } from 'class-validator';
import { WISHLIST_MAX_ITEMS } from '../constants/wishlist.constants';

export class SyncWishlistDto {
  /**
   * Guest wishlist product IDs. Existence is NOT validated here (unlike AddToWishlistDto):
   * stale IDs from the guest's localStorage are silently dropped by the service
   * instead of failing the whole sync.
   */
  @IsArray()
  @ArrayMaxSize(WISHLIST_MAX_ITEMS)
  @IsMongoId({ each: true })
  productIds!: string[];
}
