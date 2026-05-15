import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { SettingsService } from '../settings/settings.service';
import { LocationsService } from '../locations/locations.service';
import { ShippingService } from '../shipping/shipping.service';
import { ShippingRatesService } from '../shipping/shipping-rates.service';
import { PaymentsService } from '../payments/payments.service';
import { TaxesService } from '../taxes/taxes.service';
import { PaymentType } from '../payments/shared/schema/payment-method.schema';
import { KSA_DATA } from './ksa-data';

@Injectable()
export class SeedService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly settingsService: SettingsService,
    private readonly locationsService: LocationsService,
    private readonly shippingService: ShippingService,
    private readonly shippingRatesService: ShippingRatesService,
    private readonly paymentsService: PaymentsService,
    private readonly taxesService: TaxesService,
  ) { }

  async runSeed() {
    console.log('🌱 Starting Database Seeding...');
    // 1. Seed Settings
    await this.settingsService.updateSettings({
      siteName: { ar: 'مجرة السماء', en: 'Sky Galaxy' },
      currencyCode: 'SAR',
      currencySymbol: 'ر.س',
      freeShippingThreshold: 500,
      contactInfo: {
        email: 'info@skygalaxy.com',
        phones: ['+966598909991'],
        addressAr: 'الرياض، المملكة العربية السعودية',
        addressEn: 'Riyadh, Saudi Arabia',
      },
    }, undefined);
    // 2. Seed Tax (VAT 16%)
    const existingTax = await this.connection.collection('taxes').findOne({ name: 'VAT' });
    if (!existingTax) {
      await this.taxesService.create({
        name: 'VAT',
        percentage: 16,
        isActive: true,
        isIncludedInPrice: false,
      });
    }

    // 3. Seed Country
    let country = await this.connection.collection('countries').findOne({ code: 'TR' });
    if (!country) {
      country = await this.locationsService.createCountry({
        name: { ar: 'تركيا', en: 'Turkey' },
        code: 'TR',
        phoneCode: '+90',
        currency: 'TRY',
      } as any);
    }

    // 4. Seed Region
    let region = await this.connection.collection('regions').findOne({ 'name.en': 'Istanbul Region' });
    if (!region) {
      region = await this.locationsService.createRegion({
        name: { ar: 'منطقة اسطنبول', en: 'Istanbul Region' },
        country: country._id as any,
      } as any);
    }

    // 5. Seed City
    let city = await this.connection.collection('cities').findOne({ 'name.en': 'Istanbul' });
    if (!city) {
      city = await this.locationsService.createCity({
        name: { ar: 'اسطنبول', en: 'Istanbul' },
        region: region._id as any,
        country: country._id as any,
        isDeliveryAvailable: true,
      } as any);
    }

    // 6. Seed Shipping Provider
    let provider = await this.connection.collection('shippingproviders').findOne({ code: 'sky-express' });
    if (!provider) {
      provider = await this.shippingService.createProvider({
        name: 'Sky Express',
        code: 'sky-express',
        trackingUrl: 'https://sky-express.com/track/',
      } as any);
    }

    // 7. Seed Shipping Rate
    let rate = await this.connection.collection('shippingrates').findOne({ city: city._id, provider: provider._id });
    if (!rate) {
      await this.shippingRatesService.createRate({
        provider: provider._id as any,
        city: city._id as any,
        basePrice: 25,
        baseWeight: 15,
        additionalKgPrice: 2,
        estimatedDays: '2-3 أيام',
        supportsCOD: true,
      } as any);
    }

    // 8. Seed Payment Methods
    const existingCard = await this.connection.collection('paymentmethods').findOne({ code: 'card' });
    if (!existingCard) {
      await this.paymentsService.create({
        name: 'مدى / بطاقة ائتمانية',
        code: 'card',
        type: PaymentType.CARD,
        displayOrder: 1,
      } as any);
    }

    const existingCod = await this.connection.collection('paymentmethods').findOne({ code: 'cod' });
    if (!existingCod) {
      await this.paymentsService.create({
        name: 'الدفع عند الاستلام',
        code: 'cod',
        type: PaymentType.CASH,
        displayOrder: 2,
        fees: 15, // رسوم إضافية لخدمة الدفع عند الاستلام
      } as any);
    }

    console.log('✅ Seeding Completed Successfully!');
  }

  async seedKSA() {
    console.log('🌱 Starting KSA Regions and Cities Seeding...');

    // Get or create Saudi Arabia
    let country: any;
    try {
      const existing = await this.connection.collection('countries').findOne({ code: 'SA' });
      if (existing) {
        country = existing;
      } else {
        country = await this.locationsService.createCountry({
          name: { ar: 'المملكة العربية السعودية', en: 'Saudi Arabia' },
          code: 'SA',
          phoneCode: '+966',
          currency: 'SAR',
        } as any);
      }
    } catch (err: any) {
      if (err.code === 11000) {
        country = await this.connection.collection('countries').findOne({ code: 'SA' });
      } else throw err;
    }

    for (const regionData of KSA_DATA) {
      // Find or create Region
      const regions = await this.locationsService.getRegionsByCountry(country._id.toString());
      let region = regions.find(r => r.name?.ar === regionData.region.ar);

      if (!region) {
        region = await this.locationsService.createRegion({
          name: regionData.region,
          country: country._id as any,
        } as any);
      }

      // Add Cities
      for (const cityData of regionData.cities) {
        const cities = await this.locationsService.getCitiesByRegion(region._id.toString());
        let city = cities.find(c => c.name?.ar === cityData.ar);

        if (!city) {
          await this.locationsService.createCity({
            name: cityData,
            region: region._id as any,
            country: country._id as any,
            isDeliveryAvailable: true,
          } as any);
        }
      }
    }
    console.log('✅ KSA Seeding Completed Successfully!');
  }
}
