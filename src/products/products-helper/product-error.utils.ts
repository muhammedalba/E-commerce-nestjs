import { ConflictException } from '@nestjs/common';

/**
 * UTILITY: Precise Duplicate Key Error Handling
 * Maps MongoDB E11000 errors to accurate HTTP domain exceptions.
 */
export function handleDuplicateKeyError(error: any, i18n: any): never {
  const keyPattern = error.keyPattern || {};

  if (keyPattern.slug) {
    throw new ConflictException(i18n.translate('exception.NAME_EXISTS'));
  }
  if (keyPattern.sku) {
    throw new ConflictException(i18n.translate('exception.SKU_EXISTS'));
  }
  if (keyPattern.barcode) {
    throw new ConflictException(i18n.translate('exception.BARCODE_EXISTS'));
  }

  throw new ConflictException(i18n.translate('exception.NAME_EXISTS'));
}
