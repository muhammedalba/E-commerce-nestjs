import * as crypto from 'crypto';
import { isMeasuredAttribute } from './data-normalizer';
import { Model } from 'mongoose';
import { ProductVariantDocument } from '../schemas/ProductVariant.schema';

/**
 * Generates a deterministic, collision-safe, human-readable SKU.
 * Format: {PREFIX}-{ATTRS}-{SHORT_HASH}
 * Example: EPX-20KG-BLK-A3F2
 *
 * @param productSlug Used as prefix (first 3-4 chars)
 * @param attributes Normalized variant attributes
 * @param components Multi-part components
 */
export function generateDeterministicSku(
  productSlug: string,
  attributes?: Record<string, unknown>,
  components?: Array<{ name: string; value: number; unit: string }>,
): string {
  // 1. Prefix: take first 3-4 alphanumeric chars of slug, uppercase
  const prefix = productSlug
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 4)
    .toUpperCase()
    .trim()
    .padEnd(3, 'X');

  // 2. Attributes core (human readable parts)
  const attrParts: string[] = [];
  const hashObj: Record<string, any> = {};

  if (attributes && Object.keys(attributes).length > 0) {
    // Sort keys to ensure deterministic hash
    const keys = Object.keys(attributes).sort();

    for (const key of keys) {
      const val = attributes[key];
      hashObj[key] = val;

      if (isMeasuredAttribute(val)) {
        // e.g. 20KG
        attrParts.push(`${val.value}${val.unit.toUpperCase().trim()}`);
      } else if (typeof val === 'string') {
        // e.g. BLK
        // Take first 3 consonants if possible, or just first 3 chars
        const consonants = val.replace(/[aeiou\s]/gi, '');
        const shortVal = (consonants.length >= 2 ? consonants : val)
          .substring(0, 3)
          .toUpperCase()
          .trim();
        attrParts.push(shortVal);
      }
    }
  }

  // 3. Components (e.g. A20KG, B4LTR)
  if (components && components.length > 0) {
    const sortedComponents = [...components].sort((a, b) =>
      a.name.trim().localeCompare(b.name.trim()),
    );
    for (const comp of sortedComponents) {
      attrParts.push(`${comp.name}${comp.value}${comp.unit.toUpperCase()}`);
      hashObj[`comp_${comp.name}`] = `${comp.value}${comp.unit}`;
    }
  }

  // Combine human readable parts (max 3 parts to avoid crazy long SKUs)
  const humanReadable = attrParts.slice(0, 3).join('-');

  // 4. Short Hash to prevent collisions on similar strings
  // Hash the entire attributes/components object deterministically
  const hashString = JSON.stringify(hashObj);
  const shortHash = crypto
    .createHash('md5')
    .update(hashString)
    .digest('hex')
    .substring(0, 4)
    .toUpperCase().trim();

  return [prefix, humanReadable, shortHash].filter(Boolean).join('-');
}

/**
 * Ensures uniqueness of a generated SKU by checking the DB.
 * If collision occurs (rare, but possible if exact same attributes exist on another variant),
 * appends a counter.
 *
 * @param model ProductVariant model
 * @param baseSku Generated SKU
 * @param maxAttempts Max collision retries
 */
export async function ensureUniqueSku(
  model: Model<ProductVariantDocument>,
  baseSku: string,
  maxAttempts = 5,
): Promise<string> {
  let sku = baseSku;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const exists = await model.exists({ 
      sku,
      isDeleted: { $in: [true, false] } // Bypass soft-delete hook
    }).lean();
    if (!exists) {
      return sku;
    }
    attempts++;
    sku = `${baseSku}-${attempts}`;
  }

  // If we exhaust attempts, append timestamp to guarantee uniqueness
  return `${baseSku}-${Date.now().toString().slice(-4)}`;
}
