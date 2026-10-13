import { ConflictException } from '@nestjs/common';
import { FilterQuery, Model } from 'mongoose';
import { Product } from 'src/products/shared/schemas/Product.schema';
import { CustomI18nService } from './i18n/custom-i18n.service';

/**
 * Blocks deleting a category / sub-category / brand / supplier that products
 * still point to. MongoDB has no foreign keys: without this check those
 * products would keep a dangling id and `populate` would return null for it.
 * Soft-deleted products count too, since they can be restored.
 */
export async function assertNoLinkedProducts(
  productModel: Model<Product>,
  filter: FilterQuery<Product>,
  i18n: CustomI18nService,
): Promise<void> {
  if (await productModel.exists(filter)) {
    throw new ConflictException(i18n.translate('exception.IN_USE_BY_PRODUCTS'));
  }
}
