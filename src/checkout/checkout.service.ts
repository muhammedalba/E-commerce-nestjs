import { Injectable, BadRequestException } from '@nestjs/common';
import { LocationsService } from '../locations/locations.service';
import { ShippingService } from '../shipping/shipping.service';
import { ShippingRatesService } from '../shipping/shipping-rates.service';
import { TaxesService } from '../taxes/taxes.service';
import { PaymentsService } from '../payments/payments.service';
import { SettingsService } from '../settings/settings.service';
import { CouponHelperService } from 'src/coupons/shared/coupon.helper';

export interface CheckoutPreviewDto {
  cityId: string;
  items: {
    productId: string;
    variantId: string;
    quantity: number;
    weight: number;
    price: number;
  }[];
  paymentMethodId: string;
  shippingProviderId: string;
  couponCode?: string;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly locationsService: LocationsService,
    private readonly shippingService: ShippingService,
    private readonly shippingRatesService: ShippingRatesService,
    private readonly taxesService: TaxesService,
    private readonly paymentsService: PaymentsService,
    private readonly settingsService: SettingsService,
    private readonly couponHelperService: CouponHelperService,
  ) {}

  async getCheckoutPreview(dto: CheckoutPreviewDto, userId?: string) {
    // 1. حساب المجموع الفرعي والوزن الإجمالي
    const subtotal = dto.items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );
    const totalWeight = dto.items.reduce(
      (acc, item) => acc + item.weight * item.quantity,
      0,
    );

    // 2. جلب الإعدادات العامة
    const settings = await this.settingsService.getSettings();

    // 3. التحقق من الحد الأدنى للطلب
    const minOrderAmount = settings.minOrderAmount || 0;
    if (minOrderAmount > 0 && subtotal < minOrderAmount) {
      const currency = settings.currencySymbol || 'ر.س';
      throw new BadRequestException(
        `الحد الأدنى للطلب هو ${minOrderAmount} ${currency}`,
      );
    }

    // 4. التحقق من المدينة
    const city = await this.locationsService.getCityById(dto.cityId);
    if (!city.isDeliveryAvailable) {
      throw new BadRequestException('Delivery is not available for this city');
    }

    // 5. حساب الشحن
    const shippingOptions = await this.shippingRatesService.calculateShipping(
      dto.cityId,
      totalWeight,
    );

    // البحث عن الخيار المختار
    const selectedShipping =
      shippingOptions.find(
        (opt) => opt.providerId === dto.shippingProviderId,
      ) || shippingOptions[0];
    if (!selectedShipping) {
      throw new BadRequestException(
        'No shipping options available for this city',
      );
    }

    let shippingCost = selectedShipping.totalShippingCost;

    // التحقق من عتبة الشحن المجاني من الإعدادات العامة
    const freeShippingThreshold = settings.freeShippingThreshold || 0;
    if (freeShippingThreshold > 0 && subtotal >= freeShippingThreshold) {
      shippingCost = 0;
    }

    // 6. حساب الضرائب
    const countryId = (city.country as any)?._id
      ? (city.country as any)._id.toString()
      : city.country?.toString();
    const taxDetails = await this.taxesService.calculateTax(
      subtotal,
      countryId,
    );

    // 5. التحقق من وسيلة الدفع
    const paymentMethod = await this.paymentsService.findById(
      dto.paymentMethodId,
    );
    if (!paymentMethod || !paymentMethod.isActive) {
      throw new BadRequestException('Invalid or inactive payment method');
    }

    // التحقق من توافق COD
    if (paymentMethod.code === 'cod' && !selectedShipping.supportsCOD) {
      throw new BadRequestException(
        'Cash on Delivery is not supported by the selected shipping provider',
      );
    }

    // 6. حساب الخصم عبر CouponHelperService
    let discount = 0;
    let couponDetails: any = null;

    if (dto.couponCode && userId) {
      const couponPreview =
        await this.couponHelperService.applyCouponIfAvailable(
          dto.couponCode,
          userId,
          subtotal,
        );
      discount = couponPreview.discountAmount;
      couponDetails = couponPreview.couponDetails;
    }

    // 7. تجميع النتيجة النهائية
    const total =
      subtotal +
      shippingCost +
      (taxDetails.isIncluded ? 0 : taxDetails.taxAmount) +
      paymentMethod.fees -
      discount;

    return {
      summary: {
        subtotal,
        totalWeight,
        shippingCost,
        taxAmount: taxDetails.taxAmount,
        taxPercentage: taxDetails.taxPercentage,
        paymentFees: paymentMethod.fees,
        discount,
        total,
        currency: settings.currencySymbol || 'SAR',
      },
      delivery: {
        cityId: dto.cityId,
        cityName: city.name,
        providerId: selectedShipping.providerId,
        providerName: selectedShipping.providerName,
        rateId: selectedShipping.rateId,
        estimatedDays: selectedShipping.estimatedDays,
      },
      payment: {
        methodId: dto.paymentMethodId,
        methodName: paymentMethod.name,
        methodCode: paymentMethod.code,
        fees: paymentMethod.fees,
      },
      couponDetails,
      shippingOptions,
    };
  }
}
