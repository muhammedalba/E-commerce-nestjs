import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { SettingsService } from '../settings/settings.service';
import { LocationsService } from '../locations/locations.service';
import { ShippingService } from '../shipping/shipping.service';
import { ShippingRatesService } from '../shipping/shipping-rates.service';
import { PaymentsService } from '../payments/payments.service';
import { TaxesService } from '../taxes/taxes.service';
import { TaxScope } from '../taxes/shared/schema/tax.schema';
import { ShippingRateScope } from '../shipping/shared/schema/shipping-rate.schema';
import { PaymentType } from '../payments/shared/schema/payment-method.schema';
import { KSA_DATA } from './ksa-data';
import { WEBER_PRODUCTS_DATA } from './weber-products-data';
import {
  FULL_CATALOG_BRANDS,
  FULL_CATALOG_CATEGORIES,
  FULL_CATALOG_PRODUCTS,
} from './full-catalog-data';
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
      // logo: '/uploads/Setting/default.png',
      // favicon: '/uploads/Setting/default.png',

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
        reviewsVerifiedOnly: false,
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
      enablePerformance: false,

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
        scope: TaxScope.GLOBAL,
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
        scope: ShippingRateScope.GLOBAL,
        basePrice: 25,
        baseWeight: 15,
        additionalKgPrice: 2,
        estimatedDays: '2-3 أيام',
        supportsCOD: true,
      });
    }

    // 8. Seed Payment Methods

    // ---------------------------
    // 1) بطاقة بنكية (Moyasar)
    // ---------------------------
    const existingCard = await this.connection
      .collection('paymentmethods')
      .findOne({ code: 'card' });

    if (!existingCard) {
      await this.paymentsService.create({
        name: {
          ar: 'الدفع بالبطاقة البنكية',
          en: 'Pay with Bank Card',
        },
        description: {
          ar: 'يمكنك الدفع باستخدام بطاقات مدى، فيزا، أو ماستركارد عبر بوابة ميسر.',
          en: 'Pay securely using Mada, Visa, or Mastercard through Moyasar gateway.',
        },
        code: 'moyasar',
        type: PaymentType.CARD,
        provider: 'MOYASAR',
        displayOrder: 1,
        fixedFee: 0,
        percentageFee: 0,
      } as any);
    }

    // ---------------------------
    // 2) الدفع عند الاستلام (COD)
    // ---------------------------
    const existingCod = await this.connection
      .collection('paymentmethods')
      .findOne({ code: 'cod' });

    if (!existingCod) {
      await this.paymentsService.create({
        name: {
          ar: 'الدفع عند الاستلام',
          en: 'Cash on Delivery',
        },
        description: {
          ar: 'يمكنك الدفع نقدًا عند استلام الطلب. قد يتم تطبيق رسوم إضافية لهذه الخدمة.',
          en: 'Pay in cash when your order is delivered. Additional service fees may apply.',
        },
        code: 'cod',
        type: PaymentType.CASH_ON_DELIVERY,
        provider: 'COD',
        displayOrder: 2,
        fixedFee: 15, // رسوم إضافية لخدمة الدفع عند الاستلام
        percentageFee: 0,
      } as any);
    }

    // ---------------------------
    // 3) التحويل البنكي
    // ---------------------------
    const existingBankTransfer = await this.connection
      .collection('paymentmethods')
      .findOne({ code: 'bankTransfer' });

    if (!existingBankTransfer) {
      await this.paymentsService.create({
        name: {
          ar: 'تحويل بنكي إلى حسابنا',
          en: 'Bank Transfer to Our Account',
        },
        description: {
          ar: 'يمكنك تحويل المبلغ إلى حسابنا البنكي وإرسال الإيصال لإتمام الطلب.',
          en: 'You can transfer the amount to our bank account and send the receipt to complete your order.',
        },
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
          country: country._id,
        } as any);
      }

      // Add Cities
      for (const cityData of regionData.cities) {
        const cities = await this.locationsService.getCitiesByRegion(
          region._id.toString(),
        );
        const city = cities.find((c) => c.name?.ar === cityData.ar);

        if (!city) {
          await this.locationsService.createCity({
            name: cityData,
            region: region._id,
            country: country._id,
            isDeliveryAvailable: true,
          } as any);
        }
      }
    }
    console.log('✅ KSA Seeding Completed Successfully!');
  }

  async seedWeberProducts() {
    console.log('🌱 Starting Weber Products Seeding...');

    const Brand = this.connection.collection('brands');
    const Category = this.connection.collection('categories');
    const SubCategory = this.connection.collection('subcategories');
    const Product = this.connection.collection('products');
    const ProductVariant = this.connection.collection('productvariants');

    // 1. Find or Create Brand: Weber Sodamco
    let brand = await Brand.findOne({ slug: 'weber-sodamco' });
    if (!brand) {
      const res = await Brand.insertOne({
        name: { ar: 'سودامكو ويبر', en: 'Weber Sodamco' },
        slug: 'weber-sodamco',
        image: {
          url: '/uploads/brands/weber.png',
          publicId: 'weber-brand-default',
          provider: 'local',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      brand = await Brand.findOne({ _id: res.insertedId });
      console.log('📦 Created Brand: Weber Sodamco');
    }

    // 2. Categories & Subcategories
    const subCategoryMap = new Map<
      string,
      { categoryId: Types.ObjectId; subCategoryId: Types.ObjectId }
    >();

    // Weber shares the single catalogue taxonomy so that running this seeder
    // before or after seedFullCatalog() yields the same category tree.
    for (const catData of FULL_CATALOG_CATEGORIES) {
      let category = await Category.findOne({ slug: catData.slug });
      if (!category) {
        const res = await Category.insertOne({
          name: catData.name,
          slug: catData.slug,
          image: {
            url: '/uploads/Category/default.png',
            publicId: 'default-category',
            provider: 'local',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        category = await Category.findOne({ _id: res.insertedId });
        console.log(
          `📁 Created Category: ${catData.name.ar} (${catData.slug})`,
        );
      }

      for (const subCatData of catData.subCategories) {
        let subCategory = await SubCategory.findOne({ slug: subCatData.slug });
        if (!subCategory) {
          const res = await SubCategory.insertOne({
            name: subCatData.name,
            slug: subCatData.slug,
            category: category!._id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          subCategory = await SubCategory.findOne({ _id: res.insertedId });
          console.log(
            `  📂 Created SubCategory: ${subCatData.name.ar} (${subCatData.slug})`,
          );
        } else {
          await SubCategory.updateOne(
            { _id: subCategory._id },
            { $set: { category: category!._id, name: subCatData.name } },
          );
        }

        subCategoryMap.set(subCatData.slug, {
          categoryId: category!._id as Types.ObjectId,
          subCategoryId: subCategory!._id as Types.ObjectId,
        });
      }
    }

    // 3. Products & Variants
    let totalVariantsSeeded = 0;

    for (const productFamily of WEBER_PRODUCTS_DATA) {
      const classification = subCategoryMap.get(productFamily.subCategorySlug);
      if (!classification) {
        console.warn(
          `⚠️ Warning: Subcategory not found for slug: ${productFamily.subCategorySlug}`,
        );
        continue;
      }

      const { categoryId, subCategoryId } = classification;

      const prices = productFamily.variants.map((v) => v.price);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;
      const totalStock = productFamily.variants.reduce(
        (sum, v) => sum + v.stock,
        0,
      );

      let product = await Product.findOne({ slug: productFamily.slug });
      const productPayload = {
        title: productFamily.title,
        slug: productFamily.slug,
        description: productFamily.description,
        category: categoryId,
        SubCategories: [subCategoryId],
        brand: brand!._id,
        allowedAttributes: productFamily.allowedAttributes.map((att) => ({
          ...att,
          name: att.name.trim().toLowerCase(),
        })),
        allowedAttributesVersion: 1,
        imageCover: {
          url: '/uploads/Product/default.png',
          publicId: 'default-weber-cover',
          provider: 'local',
        },
        images: [],
        uses: { ar: [], en: [] },
        isUnlimitedStock: false,
        isActive: true,
        priceRange: { min: minPrice, max: maxPrice },
        stockSummary: totalStock,
        variantCount: productFamily.variants.length,
        isDeleted: false,
        updatedAt: new Date(),
      };

      if (!product) {
        const res = await Product.insertOne({
          ...productPayload,
          createdAt: new Date(),
        });
        product = await Product.findOne({ _id: res.insertedId });
        console.log(`🏷️ Created Product: ${productFamily.title.ar}`);
      } else {
        await Product.updateOne({ _id: product._id }, { $set: productPayload });
        console.log(`🔄 Updated Product: ${productFamily.title.ar}`);
      }

      for (const variantData of productFamily.variants) {
        const variantPayload = {
          productId: product!._id,
          sku: variantData.sku.toUpperCase().trim(),
          label: `${variantData.label.ar} (${variantData.label.en})`,
          price: variantData.price,
          stock: variantData.stock,
          attributes: variantData.attributes,
          shippingProfile: variantData.shippingProfile,
          components: variantData.components || [],
          isActive: true,
          isDeleted: false,
          updatedAt: new Date(),
        };

        const existingVariant = await ProductVariant.findOne({
          sku: variantPayload.sku,
        });

        if (existingVariant) {
          await ProductVariant.updateOne(
            { _id: existingVariant._id },
            { $set: variantPayload },
          );
        } else {
          await ProductVariant.insertOne({
            ...variantPayload,
            reserved: 0,
            sold: 0,
            createdAt: new Date(),
          });
        }
        totalVariantsSeeded++;
      }
    }

    console.log(
      `✅ Weber Seeding Completed: ${WEBER_PRODUCTS_DATA.length} products, ${totalVariantsSeeded} variants`,
    );
    return {
      productsCount: WEBER_PRODUCTS_DATA.length,
      variantsCount: totalVariantsSeeded,
    };
  }

  async seedFullCatalog() {
    console.log('🌱 Starting Full Multi-Brand Catalog Seeding...');

    const Brand = this.connection.collection('brands');
    const Category = this.connection.collection('categories');
    const SubCategory = this.connection.collection('subcategories');
    const Product = this.connection.collection('products');
    const ProductVariant = this.connection.collection('productvariants');

    // 1. Seed Brands
    const brandMap = new Map<string, Types.ObjectId>();
    for (const b of FULL_CATALOG_BRANDS) {
      let brandDoc = await Brand.findOne({ slug: b.slug });
      if (!brandDoc) {
        const res = await Brand.insertOne({
          name: b.name,
          slug: b.slug,
          image: {
            url: '/uploads/Brand/default.png',
            publicId: '/uploads/Brand/default.png',
            provider: 'local',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        brandDoc = await Brand.findOne({ _id: res.insertedId });
      }
      brandMap.set(b.slug, brandDoc!._id as Types.ObjectId);
    }

    // 2. Seed Categories & Subcategories
    const subCategoryMap = new Map<
      string,
      { categoryId: Types.ObjectId; subCategoryId: Types.ObjectId }
    >();

    for (const cat of FULL_CATALOG_CATEGORIES) {
      let categoryDoc = await Category.findOne({ slug: cat.slug });
      if (!categoryDoc) {
        const res = await Category.insertOne({
          name: cat.name,
          slug: cat.slug,
          image: {
            url: '/uploads/Category/default.png',
            publicId: '/uploads/Category/default.png',
            provider: 'local',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        categoryDoc = await Category.findOne({ _id: res.insertedId });
      }

      for (const sub of cat.subCategories) {
        let subDoc = await SubCategory.findOne({ slug: sub.slug });
        if (!subDoc) {
          const res = await SubCategory.insertOne({
            name: sub.name,
            slug: sub.slug,
            category: categoryDoc!._id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          subDoc = await SubCategory.findOne({ _id: res.insertedId });
        } else {
          await SubCategory.updateOne(
            { _id: subDoc._id },
            { $set: { category: categoryDoc!._id, name: sub.name } },
          );
        }
        subCategoryMap.set(sub.slug, {
          categoryId: categoryDoc!._id as Types.ObjectId,
          subCategoryId: subDoc!._id as Types.ObjectId,
        });
      }
    }

    // 3. Seed Products & Variants
    let totalVariantsSeeded = 0;

    for (const productFamily of FULL_CATALOG_PRODUCTS) {
      const classification = subCategoryMap.get(productFamily.subCategorySlug);
      if (!classification) continue;

      const brandId = brandMap.get(productFamily.brandSlug);
      const { categoryId, subCategoryId } = classification;

      const prices = productFamily.variants.map((v) => v.price);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;
      const totalStock = productFamily.variants.reduce(
        (sum, v) => sum + v.stock,
        0,
      );

      let productDoc = await Product.findOne({ slug: productFamily.slug });
      const productPayload = {
        title: productFamily.title,
        slug: productFamily.slug,
        description: productFamily.description,
        category: categoryId,
        SubCategories: [subCategoryId],
        brand: brandId,
        allowedAttributes: productFamily.allowedAttributes,
        allowedAttributesVersion: 1,
        imageCover: {
          url: '/uploads/Product/default.png',
          publicId: '/uploads/Product/default.png',
          provider: 'local',
        },
        images: [],
        uses: { ar: [], en: [] },
        isUnlimitedStock: false,
        isActive: true,
        priceRange: { min: minPrice, max: maxPrice },
        stockSummary: totalStock,
        variantCount: productFamily.variants.length,
        isDeleted: false,
        updatedAt: new Date(),
      };

      if (!productDoc) {
        const res = await Product.insertOne({
          ...productPayload,
          createdAt: new Date(),
        });
        productDoc = await Product.findOne({ _id: res.insertedId });
      } else {
        await Product.updateOne(
          { _id: productDoc._id },
          { $set: productPayload },
        );
      }

      for (const variant of productFamily.variants) {
        const variantPayload = {
          productId: productDoc!._id,
          sku: variant.sku.toUpperCase().trim(),
          label: `${variant.label.ar} (${variant.label.en})`,
          price: variant.price,
          stock: variant.stock,
          attributes: variant.attributes,
          shippingProfile: variant.shippingProfile,
          components: variant.components || [],
          isActive: true,
          isDeleted: false,
          updatedAt: new Date(),
        };

        const existingVariant = await ProductVariant.findOne({
          sku: variantPayload.sku,
        });

        if (existingVariant) {
          await ProductVariant.updateOne(
            { _id: existingVariant._id },
            { $set: variantPayload },
          );
        } else {
          await ProductVariant.insertOne({
            ...variantPayload,
            reserved: 0,
            sold: 0,
            createdAt: new Date(),
          });
        }
        totalVariantsSeeded++;
      }
    }

    console.log(
      `✅ Full Catalog Seeding Completed: ${FULL_CATALOG_PRODUCTS.length} products, ${totalVariantsSeeded} variants`,
    );
    return {
      brandsCount: FULL_CATALOG_BRANDS.length,
      categoriesCount: FULL_CATALOG_CATEGORIES.length,
      productsCount: FULL_CATALOG_PRODUCTS.length,
      variantsCount: totalVariantsSeeded,
    };
  }
}
