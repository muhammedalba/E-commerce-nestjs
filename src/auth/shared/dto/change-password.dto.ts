import { Transform } from 'class-transformer';
import {
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  Validate,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { MatchPasswordValidator } from 'src/users/shared/validators/match-password.validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(6, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(32, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  currentPassword!: string;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(6, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(32, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Validate(MatchPasswordValidator)
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  password!: string;

  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(6, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(32, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Validate(MatchPasswordValidator)
  @Transform(({ value }: { value: string }) => value?.toString().trim(), {
    toClassOnly: true,
  })
  confirmPassword!: string;
}
