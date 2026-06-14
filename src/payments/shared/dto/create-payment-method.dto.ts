import {
  IsString,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsObject,
  IsArray,
} from 'class-validator';
import { PaymentType } from '../schema/payment-method.schema';

export class CreatePaymentMethodDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsEnum(PaymentType)
  type!: PaymentType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  fixedFee?: number;

  @IsNumber()
  @IsOptional()
  percentageFee?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  provider!: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportedCountries?: string[];

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresOnlineConfirmation?: boolean;

  @IsBoolean()
  @IsOptional()
  passFeesToCustomer?: boolean;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportedCurrencies?: string[];

  @IsNumber()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  requiresAdditionalInfo?: boolean;
}
