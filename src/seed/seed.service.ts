import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { SettingsService } from '../settings/settings.service';
import { LocationsService } from '../locations/locations.service';
import { ShippingService } from '../shipping/shipping.service';
import { PaymentsService } from '../payments/payments.service';
import { TaxesService } from '../taxes/taxes.service';
import { PaymentType } from '../payments/shared/schema/payment-method.schema';

@Injectable()
export class SeedService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly settingsService: SettingsService,
    private readonly locationsService: LocationsService,
    private readonly shippingService: ShippingService,
    private readonly paymentsService: PaymentsService,
    private readonly taxesService: TaxesService,
  ) {}

  async runSeed() {
    console.log('🌱 Starting Database Seeding...');

    // 1. Seed Settings
    await this.settingsService.updateSettings({
      siteName: { ar: 'سكاي جالاكسي', en: 'Sky Galaxy' },
      currencyCode: 'SAR',
      currencySymbol: 'ر.س',
      freeShippingThreshold: 500,
      contactInfo: {
        email: 'info@skygalaxy.com',
        phones: ['+966500000000'],
        addressAr: 'الرياض، المملكة العربية السعودية',
        addressEn: 'Riyadh, Saudi Arabia',
      },
    } as any);

    // 2. Seed Tax (VAT 15%)
    await this.taxesService.create({
      name: 'VAT',
      percentage: 15,
      isActive: true,
      isIncludedInPrice: false,
    });

    // 3. Seed Country
    const country = await this.locationsService.createCountry({
      name: { ar: 'المملكة العربية السعودية', en: 'Saudi Arabia' },
      code: 'SA',
      phoneCode: '+966',
      currency: 'SAR',
    } as any);

    // 4. Seed Region
    const region = await this.locationsService.createRegion({
      name: { ar: 'منطقة الرياض', en: 'Riyadh Region' },
      country: country._id as any,
    } as any);

    // 5. Seed City
    const city = await this.locationsService.createCity({
      name: { ar: 'الرياض', en: 'Riyadh' },
      region: region._id as any,
      country: country._id as any,
      isDeliveryAvailable: true,
    } as any);

    // 6. Seed Shipping Provider
    const provider = await this.shippingService.createProvider({
      name: 'Sky Express',
      code: 'sky-express',
      trackingUrl: 'https://sky-express.com/track/',
    } as any);

    // 7. Seed Shipping Rate
    await this.shippingService.createRate({
      provider: provider._id as any,
      city: city._id as any,
      basePrice: 25,
      baseWeight: 15,
      additionalKgPrice: 2,
      estimatedDays: '2-3 أيام',
      supportsCOD: true,
    } as any);

    // 8. Seed Payment Methods
    await this.paymentsService.create({
      name: 'مدى / بطاقة ائتمانية',
      code: 'card',
      type: PaymentType.CARD,
      displayOrder: 1,
    } as any);

    await this.paymentsService.create({
      name: 'الدفع عند الاستلام',
      code: 'cod',
      type: PaymentType.CASH,
      displayOrder: 2,
      fees: 15, // رسوم إضافية لخدمة الدفع عند الاستلام
    } as any);

    console.log('✅ Seeding Completed Successfully!');
  }
}
