import { FilterQuery } from 'mongoose';
import { ProductVariantDocument } from '../schemas/ProductVariant.schema';
import { normalizeUnit } from './data-normalizer';
import { BadRequestException } from '@nestjs/common';

export interface VariantFilterParams {
  color?: string;
  weightMin?: number;
  weightMax?: number;
  weightUnit?: string;
  volumeMin?: number;
  volumeMax?: number;
  volumeUnit?: string;
  soldMin?: number;
  soldMax?: number;
  skuSearch?: string;
}

/**
 * Sanitizes and normalizes incoming query filters, returning a clean Mongoose FilterQuery.
 * Protects against NoSQL injection via strict typing and validation.
 */
export function buildVariantFilter(
  params: VariantFilterParams,
): FilterQuery<ProductVariantDocument> {
  const vFilter: FilterQuery<ProductVariantDocument> = {};

  // 1. Color (String match, sanitized regex)
  if (params.color) {
    const colors = params.color.split(',').map((c) => c.trim());
    vFilter['attributes.color'] =
      colors.length > 1
        ? { $in: colors.map((c) => new RegExp(c, 'i')) }
        : { $regex: new RegExp(params.color, 'i') };
  }

  // 2. Weight (Numeric Range + Unit check)
  if (params.weightMin !== undefined || params.weightMax !== undefined) {
    const weightQuery: Record<string, any> = {};
    if (params.weightMin !== undefined) {
      const min = Number(params.weightMin);
      if (!isNaN(min) && min >= 0) weightQuery.$gte = min;
    }
    if (params.weightMax !== undefined) {
      const max = Number(params.weightMax);
      if (!isNaN(max) && max >= 0) weightQuery.$lte = max;
    }

    if (Object.keys(weightQuery).length > 0) {
      vFilter['attributes.weight.value'] = weightQuery;

      // Must require unit to make range meaningful
      if (!params.weightUnit) {
        throw new BadRequestException(
          'weight_unit is required when querying by weight',
        );
      }
      const unit = normalizeUnit(params.weightUnit);
      if (!unit) {
        throw new BadRequestException(
          `Invalid weight unit: ${params.weightUnit}`,
        );
      }
      vFilter['attributes.weight.unit'] = unit;
    }
  }

  // 3. Volume (Numeric Range + Unit check)
  if (params.volumeMin !== undefined || params.volumeMax !== undefined) {
    const volumeQuery: Record<string, any> = {};
    if (params.volumeMin !== undefined) {
      const min = Number(params.volumeMin);
      if (!isNaN(min) && min >= 0) volumeQuery.$gte = min;
    }
    if (params.volumeMax !== undefined) {
      const max = Number(params.volumeMax);
      if (!isNaN(max) && max >= 0) volumeQuery.$lte = max;
    }

    if (Object.keys(volumeQuery).length > 0) {
      vFilter['attributes.volume.value'] = volumeQuery;

      if (!params.volumeUnit) {
        throw new BadRequestException(
          'volume_unit is required when querying by volume',
        );
      }
      const unit = normalizeUnit(params.volumeUnit);
      if (!unit) {
        throw new BadRequestException(
          `Invalid volume unit: ${params.volumeUnit}`,
        );
      }
      vFilter['attributes.volume.unit'] = unit;
    }
  }

  // 4. Price (Numeric Range)
  if (params.soldMin !== undefined || params.soldMax !== undefined) {
    const priceQuery: Record<string, any> = {};
    if (params.soldMin !== undefined) {
      const min = Number(params.soldMin);
      if (!isNaN(min) && min >= 0) priceQuery.$gte = min;
    }
    if (params.soldMax !== undefined) {
      const max = Number(params.soldMax);
      if (!isNaN(max) && max >= 0) priceQuery.$lte = max;
    }

    if (Object.keys(priceQuery).length > 0) {
      vFilter.sold = priceQuery;
    }
  }
  // البحث عن SKU بشكل صريح بناءً على خطتك
  if (params.skuSearch) {
    vFilter.sku = { $regex: params.skuSearch, $options: 'i' };
  }
  // Only consider active, non-deleted variants
  vFilter.isDeleted = { $ne: true };
  vFilter.isActive = true;

  return vFilter;
}
