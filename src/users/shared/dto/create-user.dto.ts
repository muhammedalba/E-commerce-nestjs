import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  Validate,
  IsLowercase,
  IsNumber,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
import { MatchPasswordValidator } from '../validators/match-password.validator';
import { Transform } from 'class-transformer';
import { roles } from 'src/auth/shared/enums/role.enum';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateUserDto {
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(4, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(30, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  name!: string;

  @IsString()
  @IsOptional()
  slug!: string;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsEmail({}, { message: i18nValidationMessage('validation.INVALID_EMAIL') })
  email!: string;

  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(11, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(18, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  phone?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(6, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(32, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Validate(MatchPasswordValidator)
  password!: string;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(6, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(32, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Validate(MatchPasswordValidator)
  confirmPassword!: string;

  @IsOptional()
  role?: string | any;

  @IsOptional()
  avatar?: string;
}
