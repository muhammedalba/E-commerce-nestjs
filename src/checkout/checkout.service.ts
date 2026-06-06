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
    // 1. حساب المجموع الفرعي الأساسي
    const subtotal = dto.items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );
    // حساب الوزن الإجمالي
    const totalWeight = dto.items.reduce(
      (acc, item) => acc + item.weight * item.quantity,
      0,
    );

    // 2. تطبيق الكوبون أولاً
    let discount = 0;
    let taxableSubtotal = subtotal;
    let couponDetails: unknown = null;

    if (dto.couponCode && userId) {
      const couponPreview =
        await this.couponHelperService.applyCouponIfAvailable(
          dto.couponCode,
          userId,
          subtotal,
          //  dto.items,
        );
      discount = couponPreview.discountAmount;
      couponDetails = couponPreview.couponDetails;
      taxableSubtotal =
        couponPreview.totalPriceAfterDiscount ?? couponPreview.totalPrice;
      console.log('couponPreview : ', couponPreview);
    }

    // 3. استخراج الصافي بعد الخصم
    // const taxableSubtotal = Math.max(0, subtotal - discount);

    // 4.  التحقق من الحد الأدنى بناءً على الصافي
    const settings = await this.settingsService.getSettings();
    const minOrderAmount = settings.minOrderAmount || 0;

    if (minOrderAmount > 0 && taxableSubtotal < minOrderAmount) {
      const currency = settings.currencySymbol || 'SAR';
      throw new BadRequestException(
        `الحد الأدنى للطلب هو ${minOrderAmount} ${currency} (المجموع الحالي بعد الخصم: ${taxableSubtotal})`,
      );
    }
    if (!dto.cityId || dto.cityId === '') {
      return {
        items: dto.items,
        message:
          'Please provide a shipping city to calculate shipping and taxes.',
        totalPrice: subtotal,
        totalPriceAfterDiscount: taxableSubtotal,
        discountAmount: discount,
        couponDetails: couponDetails,
      };
    }
    // 4. التحقق من المدينة وتوفر التوصيل
    const city = (await this.locationsService.getCityById(
      dto.cityId,
    )) as unknown as {
      isDeliveryAvailable: boolean;
      country: { _id?: string } | string | undefined;
      name: { ar?: string; en?: string } | string;
    };
    if (!city.isDeliveryAvailable) {
      throw new BadRequestException('Delivery is not available for this city');
    }

    // 6. حساب الضرائب بناءً على المبلغ بعد الخصم
    const countryData = city.country;
    const countryId =
      typeof countryData === 'object'
        ? countryData?._id?.toString()
        : countryData?.toString();

    // نمرر taxableSubtotal بدلاً من subtotal الأصلي
    const taxDetails = await this.taxesService.calculateTax(
      taxableSubtotal,
      countryId,
    );

    // 7.  حساب الشحن والتحقق من عتبة الشحن المجاني بناءً على الصافي
    const shippingOptions = await this.shippingRatesService.calculateShipping(
      dto.cityId,
      totalWeight,
      taxableSubtotal, // المتاجر الكبرى تمرر الصافي لشركات الشحن
    );

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

    // التحقق من الشحن المجاني بناءً على الصافي (taxableSubtotal)
    const freeShippingThreshold = settings.freeShippingThreshold || 0;
    if (
      freeShippingThreshold > 0 &&
      taxableSubtotal >= freeShippingThreshold &&
      !settings.hasCustomShippingRates
    ) {
      shippingCost = 0;
    }

    // 8. التحقق من وسيلة الدفع ورسومها
    const paymentMethodCode = dto.paymentMethodId;
    let paymentFees = 0;
    if (paymentMethodCode) {
      if (settings.gateways?.[paymentMethodCode] === false) {
        throw new BadRequestException('Invalid or inactive payment method');
      }

      if (paymentMethodCode === 'cod' && !selectedShipping.supportsCOD) {
        throw new BadRequestException(
          'Cash on Delivery is not supported by the selected shipping provider',
        );
      }
      paymentFees = 0; // يمكن حساب رسوم الـ COD هنا لاحقاً إن وجدت
    }

    // 9. تجميع النتيجة النهائية (المعادلة الحسابية الصحيحة)
    const total =
      taxableSubtotal + // (subtotal - discount)
      shippingCost +
      (taxDetails.isIncluded ? 0 : taxDetails.taxAmount) +
      paymentFees;

    return {
      summary: {
        subtotal,
        totalWeight,
        shippingCost,
        taxAmount: taxDetails.taxAmount,
        taxPercentage: taxDetails.taxPercentage,
        paymentFees,
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
        methodId: paymentMethodCode || '',
        methodName: paymentMethodCode || '',
        methodCode: paymentMethodCode || '',
        fees: paymentFees,
      },
      couponDetails,
      shippingOptions,
      items: dto.items.map((item) => ({
        ...item,
        totalPrice: item.price * item.quantity,
      })),
    };
  }
}
