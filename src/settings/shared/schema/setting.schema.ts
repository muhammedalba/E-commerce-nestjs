import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { HydratedDocument } from 'mongoose';
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { withBaseUrl } from 'src/shared/utils/with-base-url.util';

export type SettingDocument = HydratedDocument<Setting>;

@Schema({ timestamps: true })
export class Setting {
  // The Singleton key – always 'global'
  @Prop({ type: String, unique: true, default: 'global' })
  declare key: string;

  @Prop({
    type: Object,
    required: true,
    default: { ar: 'متجري', en: 'My Store' },
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  declare siteName: FieldLocalizeDto;

  @Prop({ type: Object, required: true, default: { ar: '', en: '' } })
  @IsDefined()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  declare siteDescription: FieldLocalizeDto;

  @Prop({
    required: false,
    type: Object,
    default: { url: 'default.png', publicId: 'default.png', provider: 'local' },
  })
  declare logo: FileAsset;

  @Prop({
    required: false,
    type: Object,
    default: { url: 'default.png', publicId: 'default.png', provider: 'local' },
  })
  declare favicon: FileAsset;

  @Prop({
    type: String,
    enum: ['local', 'cloudinary'],
    default: 'local',
  })
  declare storageProvider: 'local' | 'cloudinary';

  // Currency settings
  @Prop({ type: String, default: 'SAR' })
  declare currencyCode: string;

  @Prop({ type: String, default: 'ر.س' })
  declare currencySymbol: string;

  @Prop({ type: Number, default: 1, min: 0 })
  declare exchangeRate: number;

  // Date of the last automatic exchange rate sync from an external source
  @Prop({ type: Date, default: null })
  declare exchangeRateUpdatedAt: Date | null;

  // SEO settings
  @Prop({ type: Object, required: true, default: { ar: '', en: '' } })
  @IsDefined()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  declare metaTitle: FieldLocalizeDto;

  @Prop({ type: Object, required: true, default: { ar: '', en: '' } })
  @IsDefined()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  declare metaDescription: FieldLocalizeDto;

  @Prop({ type: String, default: '' })
  declare googleAnalyticsId: string;

  // Social links
  @Prop({
    type: Object,
    default: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: '',
      tiktok: '',
      whatsapp: '',
    },
  })
  declare socialLinks: {
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
    youtube: string;
    tiktok: string;
    whatsapp: string;
  };

  // Contact information
  @Prop({
    type: Object,
    default: {
      email: '',
      phones: [],
      workingDays: { ar: '', en: '' },
      workingHours: { ar: '', en: '' },
    },
  })
  declare contactInfo: {
    email: string;
    phones: string[];
    workingDays?: FieldLocalizeDto;
    workingHours?: FieldLocalizeDto;
  };

  @Prop({
    type: Object,
    default: {
      country: { ar: '', en: '' },
      city: { ar: '', en: '' },
      area: { ar: '', en: '' },
      street: { ar: '', en: '' },
      mailBox: '',
      poBox: '',
      vatNo: '',
      crNo: '',
    },
  })
  declare businessAddress: {
    country: FieldLocalizeDto;
    city: FieldLocalizeDto;
    area: FieldLocalizeDto;
    street: FieldLocalizeDto;
    mailBox: string;
    poBox: string;
    vatNo: string;
    crNo: string;
  };

  // Store features
  @Prop({
    type: Object,
    default: {
      reviews: true,
      reviewsVerifiedOnly: false,
      coupons: true,
      guestCheckout: true,
      wishlist: true,
    },
  })
  declare features: {
    reviews: boolean;
    // Enforce review submission only for customers who have purchased the product (delivered orders)
    reviewsVerifiedOnly?: boolean;
    coupons: boolean;
    guestCheckout: boolean;
    wishlist: boolean;
  };
  // Free shipping settings
  @Prop({ type: Number, default: 0 })
  declare freeShippingThreshold: number;
  //Tax Settings
  @Prop({ type: Number, default: 0 })
  declare vatRate: number;

  @Prop({ type: Boolean, default: false })
  declare taxesIncluded: boolean;

  @Prop({ type: Number, default: 0 })
  declare minOrderAmount: number;

  @Prop({ type: Boolean, default: true })
  declare paymentsEnabled: boolean;

  // Bank Transfer Details
  @Prop({
    type: Object,
    default: {
      bankName: '',
      accountName: '',
      accountNumber: '',
      iban: '',
    },
  })
  declare bankTransferDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    iban: string;
  };

  // Advanced system settings
  @Prop({ type: Boolean, default: false })
  declare enablePerformance: boolean;
  // Added recently
  @Prop({ type: Boolean, default: true })
  declare allowRegistration: boolean;

  @Prop({ type: Boolean, default: false })
  declare autoBackup: boolean;

  @Prop({ type: String, default: '' })
  declare googleMapsApiKey: string;

  // Google Reviews settings (Google Places API)
  @Prop({
    type: Object,
    default: { enabled: false, placeId: '', reviewsUrl: '' },
  })
  declare googleReviews: {
    enabled: boolean;
    placeId: string;
    reviewsUrl: string;
  };

  // Google Places API key – stored encrypted and never sent in the public response
  @Prop({ type: String, default: '' })
  declare googlePlacesApiKey: string;

  // Fields compatible with the Frontend to prevent Validation errors
  @Prop({ type: Boolean, default: false })
  declare maintenanceMode: boolean;

  @Prop({
    type: Object,
    default: { ar: 'الموقع قيد الصيانة', en: 'Site under maintenance' },
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  declare maintenanceMessage: FieldLocalizeDto;

  // Inventory alert settings
  @Prop({ type: Boolean, default: true })
  declare inventoryAlertsEnabled: boolean;

  // Dynamic fields (not saved in the database)
  hasCustomShippingRates?: boolean;
  hasCustomTaxes?: boolean;
  hasGooglePlacesApiKey?: boolean;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);

interface SettingUrls {
  logo?: FileAsset;
  favicon?: FileAsset;
}
// function prepend base url to logo and favicon
const prependBaseUrl = (doc: SettingUrls) => {
  if (!doc) return;

  if (doc.logo) {
    doc.logo = withBaseUrl(doc.logo);
  }

  if (doc.favicon) {
    doc.favicon = withBaseUrl(doc.favicon);
  }
};

// check if logo or favicon is updated
SettingSchema.post('findOneAndUpdate', function (doc) {
  prependBaseUrl(doc as SettingUrls);
});
