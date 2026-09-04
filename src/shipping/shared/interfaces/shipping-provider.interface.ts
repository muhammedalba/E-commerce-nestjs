/**
 * Normalized shipping calculation input — consumed by any IShippingProvider implementation.
 * Currently, only the internal ShippingRatesService implements this.
 * NO external carrier APIs (DHL, FedEx, UPS, Aramex, Shippo, etc.) are used.
 */

export interface ShippingCalculationItem {
  variantId: string;
  quantity: number;
  /** Structured logistics metadata from ProductVariant.shippingProfile (canonical units) */
  shippingProfile?: {
    /** Weight of one sellable unit in grams */
    weightGrams: number;
    dimensions?: {
      lengthMm?: number;
      widthMm?: number;
      heightMm?: number;
    };
    packageType?: string;
    quantityPerPackage?: number;
  };
}

export interface ShippingCalculationInput {
  destination: {
    countryId?: string;
    regionId?: string;
    cityId?: string;
  };
  /**
   * Pre-resolved items with their shipping profiles.
   * totalWeightKg is derived from: Σ (item.shippingProfile.weightGrams / 1000 * item.quantity)
   */
  items?: ShippingCalculationItem[];
  /**
   * Pre-computed total shipment weight in kilograms.
   * Either supply `items` (to let the provider compute weight) or supply `totalWeightKg` directly.
   */
  totalWeightKg?: number;
  /** Cart subtotal after coupon — used for free-shipping threshold evaluation */
  subtotal: number;
}

export interface ShippingCalculationResult {
  providerId: string;
  providerName: string;
  basePrice: number;
  extraWeightCost: number;
  totalShippingCost: number;
  estimatedDays: string;
  supportsCOD: boolean;
  rateId: string;
}

/**
 * Interface that any shipping provider implementation must satisfy.
 * The internal ShippingRatesService is the sole current implementation.
 */
export interface IShippingProvider {
  calculateRates(
    input: ShippingCalculationInput,
  ): Promise<ShippingCalculationResult[]>;
}
