import { MeasurementUnit } from '../schemas/ProductVariant.schema';

// ─── Valid Units Set (for fast lookup) ────────────────────
const VALID_UNITS = new Set(Object.values(MeasurementUnit));

/**
 * Normalizes a unit string → lowercase + trimmed.
 * Returns the normalized unit or null if invalid.
 */
export function normalizeUnit(unit: string): string | null {
  const normalized = unit.trim().toLowerCase();
  return VALID_UNITS.has(normalized as MeasurementUnit) ? normalized : null;
}

/**
 * Normalizes an attribute name:
 * - lowercase
 * - trimmed
 * - strips non-alphanumeric (except underscore)
 */
export function normalizeAttributeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]/gu, '');
}

/**
 * Checks if a value looks like a measured attribute { value, unit }.
 */
export function isMeasuredAttribute(
  val: unknown,
): val is { value: number; unit: string } {
  return (
    val !== null && typeof val === 'object' && 'value' in val && 'unit' in val
  );
}

/**
 * Normalizes a full attributes object:
 * - Normalizes all keys
 * - Normalizes units in measured attributes
 * - Trims string attribute values
 */
export function normalizeAttributes(
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [rawKey, value] of Object.entries(attributes)) {
    const key = normalizeAttributeName(rawKey);
    if (!key) continue; // skip empty keys

    if (isMeasuredAttribute(value)) {
      const unit = normalizeUnit(value.unit);
      normalized[key] = {
        value: Number(value.value),
        unit: unit ?? value.unit.trim().toLowerCase(),
      };
    } else if (typeof value === 'string') {
      normalized[key] = value.trim().toLowerCase();
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Normalizes a full variant payload before DB write.
 * Applies all normalization rules:
 * - SKU → uppercase + trim
 * - Attributes → normalized keys/values/units
 * - Components → normalized units
 */
export function normalizeVariantData<
  T extends {
    sku?: string;
    attributes?: Record<string, unknown>;
    components?: Array<{ name: string; value: number; unit: string }>;
  },
>(variant: T): T {
  const result = { ...variant };

  // SKU normalization
  if (result.sku) {
    result.sku = result.sku.trim().toUpperCase();
  }

  // Attributes normalization
  if (result.attributes) {
    result.attributes = normalizeAttributes(result.attributes);
  }

  // Components normalization
  if (result.components) {
    result.components = result.components.map((c) => ({
      ...c,
      name: c.name.trim().toUpperCase(),
      unit: c.unit.trim().toLowerCase(),
    }));
  }

  return result;
}
