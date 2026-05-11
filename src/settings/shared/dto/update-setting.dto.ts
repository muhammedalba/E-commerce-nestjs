import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class LocalizedStringDto {
  @IsString()
  @IsOptional()
  ar?: string;

  @IsString()
  @IsOptional()
  en?: string;
}

class SocialLinksDto {
  @IsString()
  @IsOptional()
  facebook?: string;

  @IsString()
  @IsOptional()
  instagram?: string;

  @IsString()
  @IsOptional()
  twitter?: string;

  @IsString()
  @IsOptional()
  linkedin?: string;

  @IsString()
  @IsOptional()
  youtube?: string;

  @IsString()
  @IsOptional()
  tiktok?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;
}

class ContactInfoDto {
  @IsString()
  @IsOptional()
  email?: string;

  @IsOptional()
  phones?: string[];

  @IsString()
  @IsOptional()
  addressAr?: string;

  @IsString()
  @IsOptional()
  addressEn?: string;
}

class StoreFeaturesDto {
  @IsBoolean()
  @IsOptional()
  reviews?: boolean;

  @IsBoolean()
  @IsOptional()
  coupons?: boolean;

  @IsBoolean()
  @IsOptional()
  guestCheckout?: boolean;

  @IsBoolean()
  @IsOptional()
  wishlist?: boolean;
}

class GatewaysDto {
  @IsBoolean()
  @IsOptional()
  stripe?: boolean;

  @IsBoolean()
  @IsOptional()
  paypal?: boolean;

  @IsBoolean()
  @IsOptional()
  bankTransfer?: boolean;

  @IsBoolean()
  @IsOptional()
  cod?: boolean;
}

export class UpdateSettingDto {
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  @IsOptional()
  siteName?: LocalizedStringDto;

  @ValidateNested()
  @Type(() => LocalizedStringDto)
  @IsOptional()
  siteDescription?: LocalizedStringDto;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  favicon?: string;

  @IsString()
  @IsOptional()
  currencyCode?: string;

  @IsString()
  @IsOptional()
  currencySymbol?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  exchangeRate?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  freeShippingThreshold?: number;

  @ValidateNested()
  @Type(() => LocalizedStringDto)
  @IsOptional()
  metaTitle?: LocalizedStringDto;

  @ValidateNested()
  @Type(() => LocalizedStringDto)
  @IsOptional()
  metaDescription?: LocalizedStringDto;

  @IsString()
  @IsOptional()
  googleAnalyticsId?: string;

  @ValidateNested()
  @Type(() => SocialLinksDto)
  @IsOptional()
  socialLinks?: SocialLinksDto;

  @ValidateNested()
  @Type(() => ContactInfoDto)
  @IsOptional()
  contactInfo?: ContactInfoDto;

  @ValidateNested()
  @Type(() => StoreFeaturesDto)
  @IsOptional()
  features?: StoreFeaturesDto;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  vatRate?: number;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  taxesIncluded?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  debugMode?: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @ValidateNested()
  @Type(() => GatewaysDto)
  @IsOptional()
  gateways?: GatewaysDto;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  allowRegistration?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  autoBackup?: boolean;

  @IsString()
  @IsOptional()
  googleMapsApiKey?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  maintenanceMode?: boolean;

  @ValidateNested()
  @Type(() => LocalizedStringDto)
  @IsOptional()
  maintenanceMessage?: LocalizedStringDto;
}
