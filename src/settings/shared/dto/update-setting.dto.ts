import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

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

  @IsOptional()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  address?: FieldLocalizeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  workingDays?: FieldLocalizeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  workingHours?: FieldLocalizeDto;
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

class BankTransferDetailsDto {
  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  iban?: string;
}

export class UpdateSettingDto {
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  @IsOptional()
  siteName?: FieldLocalizeDto;

  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  @IsOptional()
  siteDescription?: FieldLocalizeDto;

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
  @Type(() => FieldLocalizeDto)
  @IsOptional()
  metaTitle?: FieldLocalizeDto;

  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  @IsOptional()
  metaDescription?: FieldLocalizeDto;

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
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  taxesIncluded?: boolean;

  @Type(() => Boolean)
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  debugMode?: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @Type(() => Boolean)
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  paymentsEnabled?: boolean;

  @ValidateNested()
  @Type(() => BankTransferDetailsDto)
  @IsOptional()
  bankTransferDetails?: BankTransferDetailsDto;

  @Type(() => Boolean)
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  allowRegistration?: boolean;

  @Type(() => Boolean)
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  autoBackup?: boolean;

  @IsString()
  @IsOptional()
  googleMapsApiKey?: string;

  @Type(() => Boolean)
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  maintenanceMode?: boolean;

  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  @IsOptional()
  maintenanceMessage?: FieldLocalizeDto;

  @Type(() => Boolean)
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  inventoryAlertsEnabled?: boolean;
}
