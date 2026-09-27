import {
  IsString,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
  Min,
  Max,
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

  /** Added to the order total: a negative value would act as a discount. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  fixedFee?: number;

  /** Percent of the subtotal (checkout divides by 100). */
  @IsNumber()
  @Min(0)
  @Max(100)
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
