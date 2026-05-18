import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNotEmpty,
  Validate,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
import { MatchPasswordValidator } from '../validators/match-password.validator';
import { Transform } from 'class-transformer';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

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
  @IsMongoId({ message: i18nValidationMessage('validation.INVALID_MONGO_ID') })
  @Exists(MODEL_NAMES.ROLE)
  role?: string;

  @IsOptional()
  avatar?: string;
}
