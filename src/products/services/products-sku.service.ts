import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProductVariant,
  ProductVariantDocument,
} from '../shared/schemas/ProductVariant.schema';
import {
  generateDeterministicSku as generateSku,
  ensureUniqueSku,
} from '../shared/utils/sku-generator';
import { validateAndNormalizeVariantsAttributes } from '../shared/utils/attribute.validator';

/**
 * Handles SKU generation, deduplication, and variant attribute validation.
 */
@Injectable()
export class ProductSkuService {
  constructor(
    @InjectModel(ProductVariant.name)
    private readonly variantModel: Model<ProductVariantDocument>,
  ) {}

  // ──────────────────────────────────────────────────────
  //  VALIDATE ATTRIBUTES
  // ──────────────────────────────────────────────────────

  validateVariantAttributes(
    variants: { attributes?: Record<string, unknown> }[],
    allowedAttributes: any[],
    existing_variant_count: number = 0,
    existing_simple_count: number = 0,
  ): void {
    const newSimpleCount = variants.filter(
      (v) => !v.attributes || Object.keys(v.attributes).length === 0,
    ).length;

    const totalSimpleCount = existing_simple_count + newSimpleCount;
    const totalVariantCount = existing_variant_count + variants.length;

    // Rule 1: You cannot have more than 1 "Simple" variant (no attributes)
    if (totalSimpleCount > 1) {
      throw new BadRequestException(
        'لا يمكن إنشاء أكثر من متغير واحد بدون خصائص (Simple Variant)',
      );
    }

    // Rule 2: If NO attributes are defined, you can ONLY have 1 variant total (which must be a simple variant)
    if (
      (!allowedAttributes || allowedAttributes.length === 0) &&
      totalVariantCount > 1
    ) {
      throw new BadRequestException(
        'لا يمكن إنشاء أكثر من متغير واحد لمنتج لا يحتوي على خصائص (Attributes)',
      );
    }

    validateAndNormalizeVariantsAttributes(variants, allowedAttributes);
  }

  // ──────────────────────────────────────────────────────
  //  GENERATE & VALIDATE SKUs FOR NEW VARIANTS
  // ──────────────────────────────────────────────────────

  async generateAndValidateSkus(
    variants: Array<{
      sku?: string;
      attributes?: Record<string, unknown>;
    }>,
    baseSlug: string,
  ): Promise<void> {
    const manualSkus: string[] = [];

    for (const v of variants) {
      if (!v.sku) {
        v.sku = generateSku(baseSlug, v.attributes);
        v.sku = await ensureUniqueSku(this.variantModel, v.sku);
      } else {
        v.sku = v.sku.toUpperCase().trim();
        manualSkus.push(v.sku);
      }
    }

    // Check for duplicates within the request
    const skus = variants.map((v) => v.sku as string);
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException('Duplicate SKUs found in request');
    }

    // Validate manual SKUs against DB
    if (manualSkus.length > 0) {
      await this.validateManualSkus(manualSkus);
    }
  }

  // ──────────────────────────────────────────────────────
  //  VALIDATE MANUAL SKUs AGAINST DB
  // ──────────────────────────────────────────────────────

  async validateManualSkus(skus: string[]): Promise<void> {
    const foundExisting = await this.variantModel
      .find({
        sku: { $in: skus },
        isDeleted: { $in: [true, false] },
      })
      .select('sku')
      .lean();

    if (foundExisting.length > 0) {
      throw new BadRequestException(
        `Manual SKU(s) already exist: ${foundExisting.map((v) => v.sku).join(', ')}`,
      );
    }
  }

  // ──────────────────────────────────────────────────────
  //  ENSURE UNIQUE SKU (wrapper)
  // ──────────────────────────────────────────────────────

  async ensureUnique(sku: string): Promise<string> {
    return ensureUniqueSku(this.variantModel, sku);
  }
}
