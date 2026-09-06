import { ConflictException } from '@nestjs/common';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

export interface MongoDuplicateKeyError {
  code?: number;
  keyPattern?: {
    slug?: unknown;
    sku?: unknown;
    barcode?: unknown;
    [key: string]: unknown;
  };
  keyValue?: Record<string, unknown>;
}

/**
 * UTILITY: Precise Duplicate Key Error Handling
 * Maps MongoDB E11000 errors to accurate HTTP domain exceptions.
 */
export function handleDuplicateKeyError(
  error: unknown,
  i18n: CustomI18nService,
): never {
  const mongoError =
    typeof error === 'object' && error !== null
      ? (error as MongoDuplicateKeyError)
      : undefined;
  const keyPattern = mongoError?.keyPattern;

  if (keyPattern?.slug) {
    throw new ConflictException(i18n.translate('exception.NAME_EXISTS'));
  }
  if (keyPattern?.sku) {
    throw new ConflictException(i18n.translate('exception.SKU_EXISTS'));
  }
  if (keyPattern?.barcode) {
    throw new ConflictException(i18n.translate('exception.BARCODE_EXISTS'));
  }

  throw new ConflictException(i18n.translate('exception.NAME_EXISTS'));
}
