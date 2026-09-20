import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ContactInquiryType } from '../enums/inquiry-type.enum';

export class CreateContactDto {
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(2, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(100, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  name!: string;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  @IsEmail({}, { message: i18nValidationMessage('validation.INVALID_EMAIL') })
  email!: string;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(10, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(2000, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  message!: string;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(8, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(20, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  phone!: string;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsEnum(ContactInquiryType, {
    message: i18nValidationMessage('validation.IS_ENUM'),
  })
  inquiryType!: ContactInquiryType;
}
