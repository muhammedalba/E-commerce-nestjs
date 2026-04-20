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
  priceMin?: number;
  priceMax?: number;
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
  if (params.color && typeof params.color === 'string') {
    const sanitizedColor = params.color
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .trim();
    if (sanitizedColor) {
      // NOTE: We don't use dynamic index here, this will be filtered post-category narrowed.
      vFilter['attributes.color'] = {
        $regex: new RegExp(`^${sanitizedColor}$`, 'i'),
      };
    }
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
  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    const priceQuery: Record<string, any> = {};
    if (params.priceMin !== undefined) {
      const min = Number(params.priceMin);
      if (!isNaN(min) && min >= 0) priceQuery.$gte = min;
    }
    if (params.priceMax !== undefined) {
      const max = Number(params.priceMax);
      if (!isNaN(max) && max >= 0) priceQuery.$lte = max;
    }

    if (Object.keys(priceQuery).length > 0) {
      vFilter.price = priceQuery;
    }
  }

  // Only consider active, non-deleted variants
  vFilter.isDeleted = { $ne: true };
  vFilter.isActive = true;

  return vFilter;
}
