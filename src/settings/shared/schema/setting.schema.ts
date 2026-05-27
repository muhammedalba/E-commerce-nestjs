import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { HydratedDocument } from 'mongoose';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

export type SettingDocument = HydratedDocument<Setting>;

@Schema({ timestamps: true })
export class Setting {
  // مفتاح الـ Singleton - دائماً 'global'
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
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  declare logo: string | null;

  @Prop({
    required: false,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  declare favicon: string | null;

  // إعدادات العملة
  @Prop({ type: String, default: 'SAR' })
  declare currencyCode: string;

  @Prop({ type: String, default: 'ر.س' })
  declare currencySymbol: string;

  @Prop({ type: Number, default: 1, min: 0 })
  declare exchangeRate: number;

  // إعدادات SEO
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

  // وسائل التواصل الاجتماعي
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

  // معلومات التواصل
  @Prop({
    type: Object,
    default: {
      email: '',
      phones: [],
      address: { ar: '', en: '' },
      workingDays: { ar: '', en: '' },
      workingHours: { ar: '', en: '' },
    },
  })
  declare contactInfo: {
    email: string;
    phones: string[];
    address?: FieldLocalizeDto;
    workingDays?: FieldLocalizeDto;
    workingHours?: FieldLocalizeDto;
  };

  // ميزات المتجر
  @Prop({
    type: Object,
    default: {
      reviews: true,
      coupons: true,
      guestCheckout: true,
      wishlist: true,
    },
  })
  declare features: {
    reviews: boolean;
    coupons: boolean;
    guestCheckout: boolean;
    wishlist: boolean;
  };
  // إعدادات الشحن المجاني
  @Prop({ type: Number, default: 0 })
  declare freeShippingThreshold: number;
  // إعدادات الضرائب
  @Prop({ type: Number, default: 0 })
  declare vatRate: number;

  @Prop({ type: Boolean, default: false })
  declare taxesIncluded: boolean;

  @Prop({ type: Number, default: 0 })
  declare minOrderAmount: number;

  // بوابات الدفع
  @Prop({
    type: Object,
    default: {
      stripe: true,
      paypal: false,
      bankTransfer: true,
      cod: true,
    },
  })
  declare gateways: {
    stripe: boolean;
    paypal: boolean;
    bankTransfer: boolean;
    cod: boolean;
  };
  // إعدادات النظام المتقدمة
  @Prop({ type: Boolean, default: false })
  declare debugMode: boolean;
  // المفقودة المضافة حديثاً
  @Prop({ type: Boolean, default: true })
  declare allowRegistration: boolean;

  @Prop({ type: Boolean, default: false })
  declare autoBackup: boolean;

  @Prop({ type: String, default: '' })
  declare googleMapsApiKey: string;

  // حقول متوافقة مع الـ Frontend لمنع أخطاء الـ Validation
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

  // إعدادات تنبيهات المخزون
  @Prop({ type: Boolean, default: true })
  declare inventoryAlertsEnabled: boolean;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);

interface SettingUrls {
  logo?: string;
  favicon?: string;
}
// function prepend base url to logo and favicon
const prependBaseUrl = (doc: SettingUrls) => {
  if (!doc) return;
  const baseUrl = process.env.BASE_URL || '';

  if (doc.logo && !doc.logo.startsWith('http')) {
    doc.logo = `${baseUrl}/${doc.logo.replace(/^\//, '')}`;
  }

  if (doc.favicon && !doc.favicon.startsWith('http')) {
    doc.favicon = `${baseUrl}/${doc.favicon.replace(/^\//, '')}`;
  }
};

// check if logo or favicon is updated
SettingSchema.post('findOneAndUpdate', function (doc) {
  prependBaseUrl(doc as SettingUrls);
});
