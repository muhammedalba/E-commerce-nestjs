import { Injectable } from '@nestjs/common';
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
import { RolesSeederService } from '../roles/services/roles-seeder.service';
import { UsersService } from 'src/users/users.service';

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
    private readonly rolesSeederService: RolesSeederService,
    private readonly userService: UsersService,
  ) {}

  async runSeed() {
    console.log('🌱 Starting Database Seeding...');

    const SETTINGS_DEFAULTS = {
      // Singleton key
      key: 'global',

      // Store information
      siteName: {
        ar: 'متجري',
        en: 'My Store',
      },

      siteDescription: {
        ar: 'متجر إلكتروني متكامل يوفر لك تجربة تسوق سهلة وآمنة.',
        en: 'A complete online store providing an easy and secure shopping experience.',
      },

      // Branding
      logo: 'default.png',
      favicon: 'default.png',

      // Currency
      currencyCode: 'SAR',
      currencySymbol: 'ر.س',
      exchangeRate: 1,

      // SEO
      metaTitle: {
        ar: 'متجري | متجر إلكتروني',
        en: 'My Store | Online Store',
      },

      metaDescription: {
        ar: 'تسوق عبر متجرنا الإلكتروني واحصل على أفضل المنتجات والخدمات.',
        en: 'Shop online and discover our products and services.',
      },

      googleAnalyticsId: '',

      // Social Media
      socialLinks: {
        facebook: '',
        instagram: '',
        twitter: '',
        linkedin: '',
        youtube: '',
        tiktok: '',
        whatsapp: '',
      },

      // Contact information
      contactInfo: {
        email: '',
        phones: [],

        workingDays: {
          ar: 'من الاثنين إلى الجمعة',
          en: 'Monday to Friday',
        },

        workingHours: {
          ar: 'من 8 صباحًا إلى 6 مساءً',
          en: 'From 8 AM to 6 PM',
        },
      },

      // Business address
      businessAddress: {
        country: {
          ar: 'المملكة العربية السعودية',
          en: 'Saudi Arabia',
        },

        city: {
          ar: 'الرياض',
          en: 'Riyadh',
        },

        area: {
          ar: 'الصحافة',
          en: 'Al Sahafah',
        },

        street: {
          ar: 'طريق الملك فهد',
          en: 'King Fahd Road',
        },

        mailBox: '',
        poBox: '',

        vatNo: '',
        crNo: '',
      },

      // Store features
      features: {
        reviews: true,
        coupons: true,
        guestCheckout: true,
        wishlist: true,
      },

      // Shipping
      freeShippingThreshold: 0,

      // Taxes
      vatRate: 15,
      taxesIncluded: false,

      // Minimum order
      minOrderAmount: 0,

      // Payments
      paymentsEnabled: true,

      // Bank transfer
      bankTransferDetails: {
        bankName: '',
        accountName: '',
        accountNumber: '',
        iban: '',
      },

      // Advanced system settings
      debugMode: false,

      // Registration
      allowRegistration: true,

      // Automatic backup
      autoBackup: false,

      // Google Maps
      googleMapsApiKey: '',

      // Maintenance
      maintenanceMode: false,

      maintenanceMessage: {
        ar: 'الموقع قيد الصيانة',
        en: 'Site under maintenance',
      },

      // Inventory
      inventoryAlertsEnabled: true,
    };

    // 0. Seed Roles
    await this.rolesSeederService.seedRoles();
    // seed super admin
    await this.userService.createAdminUser();

    // 1. Seed Settings
    await this.settingsService.updateSettings(SETTINGS_DEFAULTS, undefined);
    // 2. Seed Tax (VAT 16%)
    const existingTax = await this.connection
      .collection('taxes')
      .findOne({ name: 'VAT' });
    if (!existingTax) {
      await this.taxesService.create({
        name: 'VAT',
        percentage: 16,
        isActive: true,
        isIncludedInPrice: false,
      });
    }

    // 3. Seed Country
    let country = await this.connection
      .collection('countries')
      .findOne({ code: 'TR' });
    if (!country) {
      country = await this.locationsService.createCountry({
        name: { ar: 'تركيا', en: 'Turkey' },
        code: 'TR',
        phoneCode: '+90',
        currency: 'TRY',
      } as any);
    }

    // 4. Seed Region
    let region = await this.connection
      .collection('regions')
      .findOne({ 'name.en': 'Istanbul Region' });
    if (!region) {
      region = await this.locationsService.createRegion({
        name: { ar: 'منطقة اسطنبول', en: 'Istanbul Region' },
        country: country._id as any,
      } as any);
    }

    // 5. Seed City
    let city = await this.connection
      .collection('cities')
      .findOne({ 'name.en': 'Istanbul' });
    if (!city) {
      city = await this.locationsService.createCity({
        name: { ar: 'اسطنبول', en: 'Istanbul' },
        region: region._id as any,
        country: country._id as any,
        isDeliveryAvailable: true,
      } as any);
    }

    // 6. Seed Shipping Provider
    let provider = await this.connection
      .collection('shippingproviders')
      .findOne({ code: 'sky-express' });
    if (!provider) {
      provider = await this.shippingService.createProvider({
        name: 'Sky Express',
        code: 'sky-express',
        trackingUrl: 'https://sky-express.com/track/',
      } as any);
    }

    // 7. Seed Shipping Rate
    // عند عمل داتا وهمية يجب اضافة ?.toString() الى دالة createRate في ملف shipping-rates.service.ts  لحقل  fieldValue: data.city.tostring()),
    const rate = await this.connection
      .collection('shippingrates')
      .findOne({ city: city._id, provider: provider._id });
    console.log('🚀 ~ SeedService ~ runSeed ~ provider:', provider._id);
    console.log('🚀 ~ SeedService ~ runSeed ~ city:', city._id);

    if (!rate) {
      await this.shippingRatesService.createRate({
        provider: provider._id.toString(),
        // city: city._id.toString(),
        basePrice: 25,
        baseWeight: 15,
        additionalKgPrice: 2,
        estimatedDays: '2-3 أيام',
        supportsCOD: true,
      });
    }

    // 8. Seed Payment Methods
    const existingCard = await this.connection
      .collection('paymentmethods')
      .findOne({ code: 'card' });
    if (!existingCard) {
      await this.paymentsService.create({
        name: 'مدى / بطاقة ائتمانية',
        code: 'card',
        type: PaymentType.CARD,
        provider: 'MOYASAR',
        displayOrder: 1,
        fixedFee: 0,
        percentageFee: 0,
      } as any);
    }

    const existingCod = await this.connection
      .collection('paymentmethods')
      .findOne({ code: 'cod' });
    if (!existingCod) {
      await this.paymentsService.create({
        name: 'الدفع عند الاستلام',
        code: 'cod',
        type: PaymentType.CASH_ON_DELIVERY,
        provider: 'COD',
        displayOrder: 2,
        fixedFee: 15, // رسوم إضافية لخدمة الدفع عند الاستلام
        percentageFee: 0,
      } as any);
    }

    const existingBankTransfer = await this.connection
      .collection('paymentmethods')
      .findOne({ code: 'bankTransfer' });
    if (!existingBankTransfer) {
      await this.paymentsService.create({
        name: 'تحويل بنكي',
        code: 'bankTransfer',
        type: PaymentType.BANK_TRANSFER,
        provider: 'BANK_TRANSFER',
        displayOrder: 3,
        fixedFee: 0,
        percentageFee: 0,
      } as any);
    }

    console.log('✅ Seeding Completed Successfully!');
  }

  async seedKSA() {
    console.log('🌱 Starting KSA Regions and Cities Seeding...');

    // Get or create Saudi Arabia
    let country: any;
    try {
      const existing = await this.connection
        .collection('countries')
        .findOne({ code: 'SA' });
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
        country = await this.connection
          .collection('countries')
          .findOne({ code: 'SA' });
      } else throw err;
    }

    for (const regionData of KSA_DATA) {
      // Find or create Region
      const regions = await this.locationsService.getRegionsByCountry(
        country._id.toString(),
      );
      let region = regions.find((r) => r.name?.ar === regionData.region.ar);

      if (!region) {
        region = await this.locationsService.createRegion({
          name: regionData.region,
          country: country._id as any,
        } as any);
      }

      // Add Cities
      for (const cityData of regionData.cities) {
        const cities = await this.locationsService.getCitiesByRegion(
          region._id.toString(),
        );
        let city = cities.find((c) => c.name?.ar === cityData.ar);

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
