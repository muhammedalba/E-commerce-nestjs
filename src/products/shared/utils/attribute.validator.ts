import { BadRequestException } from '@nestjs/common';
import { isMeasuredAttribute, normalizeAttributes } from './data-normalizer';

// ─── Attribute Definition Interfaces ──────────────────────

export type AttributeType = 'string' | 'number';

export interface AllowedAttribute {
  name: string; // e.g. "color", "weight", "volume"
  type: AttributeType;
  required?: boolean;
  allowedUnits?: string[]; // e.g. ["kg"] for weight, ["ltr", "ml"] for volume
  allowedValues?: string[]; // e.g. ["red", "blue"] for color (optional enum)
}

/**
 * Validates a normalized variant's attributes against the product's allowed attributes definition.
 * Throws BadRequestException if validation fails.
 *
 * @param attributes Normalized attributes from the variant.
 * @param allowedAttributes Allowed attributes definition from the product.
 */
export function validateAttributes(
  attributes: Record<string, unknown> | undefined,
  allowedAttributes: AllowedAttribute[],
): void {
  // If no attributes defined on product, variant shouldn't have any either
  if (!allowedAttributes || allowedAttributes.length === 0) {
    if (attributes && Object.keys(attributes).length > 0) {
      throw new BadRequestException(
        'Product has no allowed attributes defined. Variant attributes are not permitted.',
      );
    }
    return;
  }

  const attrs = attributes || {};
  const attrsKeys = Object.keys(attrs);
  console.log(attrsKeys);
  console.log(allowedAttributes);
  // 1. Check for required attributes
  for (const def of allowedAttributes) {
    if (def.required && !(def.name.trim() in attrs)) {
      throw new BadRequestException(
        `Missing required attribute: "${def.name}"`,
      );
    }
  }

  // 2. Validate each provided attribute against definitions
  for (const key of attrsKeys) {
    // console.log(key);
    const def = allowedAttributes.find((a) => a.name.trim() === key.trim());
    if (!def) {
      throw new BadRequestException(
        `Attribute "${key}" is not allowed for this product. Allowed: ${allowedAttributes.map((a) => a.name).join(', ')}`,
      );
    }

    const value = attrs[key];

    if (def.type === 'string') {
      if (typeof value !== 'string') {
        throw new BadRequestException(`Attribute "${key}" must be a string`);
      }
      // Check enum if provided
      if (def.allowedValues && def.allowedValues.length > 0) {   
        if (!def.allowedValues.includes(value)) {
          throw new BadRequestException(
            `Invalid value "${value}" for attribute "${key}". Allowed: ${def.allowedValues.join(', ')}`,
          );
        }
      }
    } else if (def.type === 'number') {
      if (!isMeasuredAttribute(value)) {
        throw new BadRequestException(
          `Attribute "${key}" must be a measured attribute object: { value: number, unit: string }`,
        );
      }
      if (typeof value.value !== 'number' || value.value <= 0) {
        throw new BadRequestException(
          `Attribute "${key}" must have a positive numeric value`,
        );
      }
      // Check allowed units if provided
      if (def.allowedUnits && def.allowedUnits.length > 0) {
        if (!def.allowedUnits.includes(value.unit)) {
          throw new BadRequestException(
            `Invalid unit "${value.unit}" for attribute "${key}". Allowed: ${def.allowedUnits.join(', ')}`,
          );
        }
      }
    }
  }
}

/**
 * Validates multiple variants against the product's allowed attributes definition.
 * Also normalizes attributes in place before validation, to ensure keys/units map correctly.
 */
export function validateAndNormalizeVariantsAttributes(
  variants: { attributes?: Record<string, unknown> }[],
  allowedAttributes: AllowedAttribute[],
): void {
  if (!variants || variants.length === 0) return;

  for (const variant of variants) {
    if (variant.attributes) {
      variant.attributes = normalizeAttributes(variant.attributes);
    }
    validateAttributes(variant.attributes, allowedAttributes);
  }
}
