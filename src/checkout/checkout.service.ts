import { Injectable, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { LocationsService } from '../locations/locations.service';
import {
  ShippingRatesService,
  ShippingCalculationResult,
} from '../shipping/shipping-rates.service';
import { TaxesService } from '../taxes/taxes.service';
import { SettingsService } from '../settings/settings.service';
import { CouponHelperService } from 'src/coupons/shared/coupon.helper';
import { Setting } from '../settings/shared/schema/setting.schema';

// ---------------------------------------------------------------------------
// Input DTO
// ---------------------------------------------------------------------------

export interface CheckoutPreviewDto {
  cityId: string;
  items: CheckoutItem[];
  paymentMethodId: string;
  shippingProviderId: string;
  couponCode?: string;
}

export interface CheckoutItem {
  productId: string;
  variantId: string;
  quantity: number;
  weight: number;
  price: number;
  /** Brand ObjectId as string — snapshotted on the cart item at add-time. */
  brand?: string;
  /** Category ObjectId as string — snapshotted on the cart item at add-time. */
  category?: string;
}

// ---------------------------------------------------------------------------
// Internal computation types
// ---------------------------------------------------------------------------

interface CartTotals {
  subtotal: number;
  totalWeight: number;
}

interface CouponResult {
  discountAmount: number;
  /** Subtotal after coupon discount has been applied. */
  subtotalAfterDiscount: number;
  couponDetails: unknown;
}

interface TaxDetails {
  taxPercentage: number;
  taxAmount: number;
  totalWithTax: number;
  isIncluded: boolean;
}

/**
 * Minimal shape of a populated city document returned by LocationsService.
 * Avoids unsafe `as ICityData` assertions.
 */
export interface ICityData {
  isDeliveryAvailable: boolean;
  /** Populated country object or raw ObjectId string. */
  country: { _id?: string } | string | undefined;
  name: { ar?: string; en?: string } | string;
}

// ---------------------------------------------------------------------------
// Output types — used to keep the orchestrator and frontend in sync
// ---------------------------------------------------------------------------

export interface CheckoutSummary {
  subtotal: number;
  totalWeight: number;
  shippingCost: number;
  taxAmount: number;
  taxPercentage: number;
  paymentFees: number;
  discountAmount: number;
  totalPrice: number;
  currency: string;
  taxesIncluded: boolean;
}

export interface CheckoutDelivery {
  cityId: string;
  cityName: ICityData['name'];
  providerId: string;
  providerName: string;
  rateId: string;
  estimatedDays: string;
}

export interface CheckoutPayment {
  methodId: string;
  methodName: string;
  methodCode: string;
  fees: number;
}

export interface CheckoutPreviewResponse {
  summary: CheckoutSummary;
  delivery: CheckoutDelivery | null;
  payment: CheckoutPayment | null;
  couponDetails: unknown;
  shippingOptions: ShippingCalculationResult[];
  items: (CheckoutItem & { totalPrice: number })[];
  message?: string;
}

// ---------------------------------------------------------------------------
// Constants — avoid magic strings scattered throughout the code
// ---------------------------------------------------------------------------

const DEFAULT_CURRENCY = 'SAR';

/** COD payment-method code as stored in the settings gateways map. */
const COD_METHOD_CODE = 'cod';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CheckoutService {
  constructor(
    private readonly locationsService: LocationsService,
    private readonly shippingRatesService: ShippingRatesService,
    private readonly taxesService: TaxesService,
    private readonly settingsService: SettingsService,
    private readonly couponHelperService: CouponHelperService,
  ) {}

  // =========================================================================
  // Public API
  // =========================================================================

  async getCheckoutPreview(
    dto: CheckoutPreviewDto,
    userId?: string,
  ): Promise<CheckoutPreviewResponse> {
    // 1. Aggregate cart line-items into totals.
    const cartTotals = this.calculateCartTotals(dto.items);

    // 2. Fetch settings and evaluate coupon concurrently (no dependency).
    const [settings, couponResult] = await Promise.all([
      this.settingsService.getSettings(),
      this.applyCoupon(dto.couponCode, userId, cartTotals.subtotal, dto.items),
    ]);

    const currency = settings.currencySymbol ?? DEFAULT_CURRENCY;

    // 3. Validate the order meets the configured minimum amount.
    this.validateMinimumOrder(
      couponResult.subtotalAfterDiscount,
      settings,
      currency,
    );

    // 4. Early-return a lightweight response when no city is provided yet.
    if (!dto.cityId) {
      return this.buildPartialPreviewResponse(
        dto.items,
        cartTotals.subtotal,
        couponResult,
        currency,
      );
    }

    // 5. Validate city and extract the linked country ID.
    const city = await this.getAndValidateCity(dto.cityId);
    const countryId = this.extractCountryId(city);

    // 6. Run tax and shipping calculations concurrently — no dependency between them.
    const [taxDetails, shippingOptions] = await this.calculateTaxesAndShipping(
      couponResult.subtotalAfterDiscount,
      countryId,
      dto.cityId,
      cartTotals.totalWeight,
    );

    // 7. Select the requested shipping option and apply the free-shipping rule.
    const chosenShipping = this.selectShippingOption(
      shippingOptions,
      dto.shippingProviderId,
    );
    const shippingCost = this.calculateShippingCost(
      chosenShipping,
      couponResult.subtotalAfterDiscount,
      settings,
    );

    // 8. Validate the chosen payment method against settings.
    this.validatePaymentMethod(dto.paymentMethodId, chosenShipping, settings);

    // 9. Compose and return the full checkout response.
    return this.buildCheckoutResponse({
      dto,
      city,
      cartTotals,
      couponResult,
      taxDetails,
      shippingOptions,
      chosenShipping,
      shippingCost,
      currency,
    });
  }

  // =========================================================================
  // Private helpers — each handles a single responsibility
  // =========================================================================

  /**
   * Accumulates subtotal and total weight from all cart line-items in a single
   * iteration for O(n) performance.
   */
  private calculateCartTotals(items: CheckoutItem[]): CartTotals {
    return items.reduce<CartTotals>(
      (acc, item) => {
        acc.subtotal += item.price * item.quantity;
        acc.totalWeight += item.weight * item.quantity;
        return acc;
      },
      { subtotal: 0, totalWeight: 0 },
    );
  }

  /**
   * Applies a coupon code when both a code and an authenticated user are
   * present.  Returns a zero-discount result when either is absent so the
   * calling code never has to null-check.
   *
   * Builds the `validatedItems` array that CouponHelperService requires to
   * enforce brand- and category-restricted coupons.
   */
  private async applyCoupon(
    couponCode: string | undefined,
    userId: string | undefined,
    subtotal: number,
    items: CheckoutItem[] = [],
  ): Promise<CouponResult> {
    if (!userId) {
      throw new BadRequestException(
        'you should be logged in to apply a coupon',
      );
    }
    // map over items in the cart and for each item i want to include inside the item the brand and category
    const validatedItems = items.map((item) => ({
      product: {
        id: new Types.ObjectId(item.productId),
        brand: item.brand ?? '',
        category: item.category ?? '',
      },
      quantity: item.quantity,
      variantId: item.variantId,
      weight: item.weight,
      price: item.price,
    }));

    const rawResult =
      couponCode && userId
        ? await this.couponHelperService.applyCouponIfAvailable(
            couponCode,
            userId,
            subtotal,
            validatedItems,
          )
        : null;

    if (!rawResult) {
      return {
        discountAmount: 0,
        subtotalAfterDiscount: subtotal,
        couponDetails: null,
      };
    }

    return {
      discountAmount: rawResult.discountAmount,
      subtotalAfterDiscount:
        rawResult.totalPriceAfterDiscount ?? rawResult.totalPrice,
      couponDetails: rawResult.couponDetails,
    };
  }

  /**
   * Throws a BadRequestException when the post-discount subtotal falls below
   * the store's configured minimum order amount.
   */
  private validateMinimumOrder(
    subtotalAfterDiscount: number,
    settings: Setting,
    currency: string,
  ): void {
    const minOrderAmount = settings.minOrderAmount ?? 0;

    if (minOrderAmount > 0 && subtotalAfterDiscount < minOrderAmount) {
      throw new BadRequestException(
        `الحد الأدنى للطلب هو ${minOrderAmount} ${currency} (المجموع الحالي بعد الخصم: ${subtotalAfterDiscount})`,
      );
    }
  }

  /**
   * Fetches the city document and asserts delivery availability.
   * Returns a strongly typed ICityData — no `as` assertion required at the
   * call site because getCityById returns `any` and we annotate the return
   * type here once.
   */
  private async getAndValidateCity(cityId: string): Promise<ICityData> {
    const city = (await this.locationsService.getCityById(cityId)) as ICityData;

    if (!city.isDeliveryAvailable) {
      throw new BadRequestException('Delivery is not available for this city');
    }

    return city;
  }

  /**
   * Derives a plain country ID string from the populated city document.
   * Handles both populated objects ({ _id }) and raw string references.
   */
  private extractCountryId(city: ICityData): string | undefined {
    const countryData = city.country;
    return typeof countryData === 'object'
      ? countryData?._id?.toString()
      : countryData?.toString();
  }

  /**
   * Fires tax and shipping calculations concurrently — they are independent
   * computations that both depend on previously resolved values but not on
   * each other.
   */
  private async calculateTaxesAndShipping(
    subtotalAfterDiscount: number,
    countryId: string | undefined,
    cityId: string,
    totalWeight: number,
  ): Promise<[TaxDetails, ShippingCalculationResult[]]> {
    return Promise.all([
      this.taxesService.calculateTax(subtotalAfterDiscount, countryId),
      this.shippingRatesService.calculateShipping(
        cityId,
        totalWeight,
        subtotalAfterDiscount,
      ),
    ]);
  }

  /**
   * Finds the shipping option matching the requested provider ID.
   * Falls back to the first available option when no match is found.
   * Throws when no options exist at all.
   */
  private selectShippingOption(
    shippingOptions: ShippingCalculationResult[],
    shippingProviderId: string,
  ): ShippingCalculationResult {
    const chosen =
      shippingOptions.find((opt) => opt.providerId === shippingProviderId) ??
      shippingOptions[0];

    if (!chosen) {
      throw new BadRequestException(
        'No shipping options available for this city',
      );
    }

    return chosen;
  }

  /**
   * Returns the effective shipping cost after applying the free-shipping
   * threshold rule from settings.  Custom rates bypass the global threshold.
   */
  private calculateShippingCost(
    chosenShipping: ShippingCalculationResult,
    subtotalAfterDiscount: number,
    settings: Setting,
  ): number {
    const freeShippingThreshold = settings.freeShippingThreshold ?? 0;

    if (
      freeShippingThreshold > 0 &&
      subtotalAfterDiscount >= freeShippingThreshold &&
      !settings.hasCustomShippingRates
    ) {
      return 0;
    }

    return chosenShipping.totalShippingCost;
  }

  /**
   * Validates that the chosen payment method is active in settings and that
   * COD is supported by the selected shipping provider when applicable.
   */
  private validatePaymentMethod(
    paymentMethodId: string,
    chosenShipping: ShippingCalculationResult,
    settings: Setting,
  ): void {
    if (!paymentMethodId) return;

    const gatewayKey = paymentMethodId as keyof typeof settings.gateways;
    if (settings.gateways?.[gatewayKey] === false) {
      throw new BadRequestException('Invalid or inactive payment method');
    }

    if (paymentMethodId === COD_METHOD_CODE && !chosenShipping.supportsCOD) {
      throw new BadRequestException(
        'Cash on Delivery is not supported by the selected shipping provider',
      );
    }
  }

  /**
   * Builds the partial preview response returned before a city is selected.
   * Keeps the exact same payload structure as before so the frontend degrades
   * gracefully while the user fills in their address.
   */
  private buildPartialPreviewResponse(
    items: CheckoutItem[],
    subtotal: number,
    couponResult: CouponResult,
    currency: string,
  ): CheckoutPreviewResponse {
    const totalWeight = items.reduce(
      (sum, item) => sum + item.weight * item.quantity,
      0,
    );

    return {
      summary: {
        // total price before discount
        subtotal: subtotal,
        totalWeight,
        shippingCost: 0,
        taxAmount: 0,
        taxPercentage: 0,
        paymentFees: 0,
        discountAmount: couponResult.discountAmount,
        // total price before tax and shipping and fees but after discount
        totalPrice: couponResult.subtotalAfterDiscount,
        currency,
        // No city selected yet — tax cannot be determined, so taxesIncluded is always false here
        taxesIncluded: false,
      },
      delivery: null,
      payment: null,
      couponDetails: couponResult.couponDetails,
      shippingOptions: [],
      items: items.map((item) => ({
        ...item,
        totalPrice: item.price * item.quantity,
      })),
      message:
        'Please provide a shipping city to calculate shipping and taxes.',
    };
  }

  /**
   * Assembles the full, structured checkout response after all calculations
   * have completed.  The shape is identical to the original implementation to
   * guarantee frontend backward compatibility.
   */
  private buildCheckoutResponse(params: {
    dto: CheckoutPreviewDto;
    city: ICityData;
    cartTotals: CartTotals;
    couponResult: CouponResult;
    taxDetails: TaxDetails;
    shippingOptions: ShippingCalculationResult[];
    chosenShipping: ShippingCalculationResult;
    shippingCost: number;
    currency: string;
  }): CheckoutPreviewResponse {
    const {
      dto,
      city,
      cartTotals,
      couponResult,
      taxDetails,
      shippingOptions,
      chosenShipping,
      shippingCost,
      currency,
    } = params;

    // Payment fees are reserved for future gateway integrations.
    const paymentFees = 0;

    const totalPrice =
      couponResult.subtotalAfterDiscount +
      shippingCost +
      (taxDetails.isIncluded ? 0 : taxDetails.taxAmount) +
      paymentFees;

    return {
      summary: {
        subtotal: cartTotals.subtotal,
        totalWeight: cartTotals.totalWeight,
        shippingCost,
        taxAmount: taxDetails.taxAmount,
        taxPercentage: taxDetails.taxPercentage,
        paymentFees,
        discountAmount: couponResult.discountAmount,
        totalPrice,
        currency,
        taxesIncluded: taxDetails.isIncluded,
      },
      delivery: {
        cityId: dto.cityId,
        cityName: city.name,
        providerId: chosenShipping.providerId,
        providerName: chosenShipping.providerName,
        rateId: chosenShipping.rateId,
        estimatedDays: chosenShipping.estimatedDays,
      },
      payment: {
        methodId: dto.paymentMethodId ?? '',
        methodName: dto.paymentMethodId ?? '',
        methodCode: dto.paymentMethodId ?? '',
        fees: paymentFees,
      },
      couponDetails: couponResult.couponDetails,
      shippingOptions,
      items: dto.items.map((item) => ({
        ...item,
        totalPrice: item.price * item.quantity,
      })),
    };
  }
}
