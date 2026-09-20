import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { CustomerType } from '../enums/customer-type.enum';
import { PreferredContactMethod } from '../enums/preferred-contact-method.enum';

export class CreateQuoteRequestDto {
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsEnum(CustomerType, {
    message: i18nValidationMessage('validation.IS_ENUM'),
  })
  customerType!: CustomerType;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(2, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(100, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  name!: string;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(8, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(20, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  phone!: string;

  // Individuals submit a single email; companies may submit several
  // (per-department billing/procurement contacts), so this always models
  // an array — the frontend just renders one input for individuals.
  @IsArray()
  @ArrayMinSize(1, { message: i18nValidationMessage('validation.NOT_EMPTY') })
  @ArrayMaxSize(5)
  @IsEmail(
    {},
    { each: true, message: i18nValidationMessage('validation.INVALID_EMAIL') },
  )
  @Transform(
    ({ value }: { value: string[] }) =>
      Array.isArray(value) ? value.map((v) => v?.toString().trim()) : value,
    { toClassOnly: true },
  )
  emails!: string[];

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsEnum(PreferredContactMethod, {
    message: i18nValidationMessage('validation.IS_ENUM'),
  })
  preferredContactMethod!: PreferredContactMethod;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(10, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(2000, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  orderDetails!: string;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(10, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(500, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  deliveryAddress!: string;

  // Company-only fields — skipped entirely (via ValidateIf) when
  // customerType is 'individual', required when it's 'company'.
  @ValidateIf(
    (dto: CreateQuoteRequestDto) => dto.customerType === CustomerType.COMPANY,
  )
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(2, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(50, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  commercialRegistrationNumber?: string;

  @ValidateIf(
    (dto: CreateQuoteRequestDto) => dto.customerType === CustomerType.COMPANY,
  )
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(2, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(50, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  taxNumber?: string;

  @ValidateIf(
    (dto: CreateQuoteRequestDto) => dto.customerType === CustomerType.COMPANY,
  )
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(10, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(500, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  nationalAddress?: string;
}
