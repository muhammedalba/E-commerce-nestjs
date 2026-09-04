export type WeightUnit = 'g' | 'kg' | 'lb' | 'oz';
export type DimensionUnit = 'mm' | 'cm' | 'm' | 'in';

export const WEIGHT_CONVERSION_TO_GRAMS: Record<WeightUnit, number> = {
  g: 1,
  kg: 1000,
  lb: 453.59237,
  oz: 28.3495,
};

export const DIMENSION_CONVERSION_TO_MM: Record<DimensionUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
};

export class UnitConverter {
  /**
   * Converts a weight from the given unit to grams.
   */
  static toGrams(value: number, unit: string): number {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`Invalid weight value: ${value}`);
    }
    const normalizedUnit = (unit || '').trim().toLowerCase() as WeightUnit;
    const factor = WEIGHT_CONVERSION_TO_GRAMS[normalizedUnit];
    if (!factor) {
      throw new Error(
        `Unsupported weight unit: "${unit}". Allowed: ${Object.keys(WEIGHT_CONVERSION_TO_GRAMS).join(', ')}`,
      );
    }
    return Math.round(value * factor * 1000) / 1000;
  }

  /**
   * Converts grams to kilograms.
   */
  static gramsToKg(grams: number): number {
    if (typeof grams !== 'number' || isNaN(grams)) {
      return 0;
    }
    return Math.round((grams / 1000) * 1000) / 1000;
  }

  /**
   * Converts a linear dimension from the given unit to millimeters.
   */
  static toMillimeters(value: number, unit: string): number {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`Invalid dimension value: ${value}`);
    }
    const normalizedUnit = (unit || '').trim().toLowerCase() as DimensionUnit;
    const factor = DIMENSION_CONVERSION_TO_MM[normalizedUnit];
    if (!factor) {
      throw new Error(
        `Unsupported dimension unit: "${unit}". Allowed: ${Object.keys(DIMENSION_CONVERSION_TO_MM).join(', ')}`,
      );
    }
    return Math.round(value * factor * 100) / 100;
  }
}
