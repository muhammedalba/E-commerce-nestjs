import {
  IsString,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentType, FeeType } from '../schema/payment-method.schema';
import { FieldLocalizeDto } from '../../../shared/utils/field-locolaized.dto';

export class CreatePaymentMethodDto {
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  name!: FieldLocalizeDto;

  @IsString()
  code!: string;

  @IsEnum(PaymentType)
  type!: PaymentType;

  @IsEnum(FeeType)
  feeType!: FeeType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  fixedFee?: number;

  @IsNumber()
  @IsOptional()
  percentageFee?: number;

  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  @IsOptional()
  description?: FieldLocalizeDto;

  @IsString()
  provider!: string;

  @IsObject()
  @IsOptional()
  publicConfig?: Record<string, any>;

  @IsObject()
  @IsOptional()
  secretConfig?: Record<string, any>;

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
