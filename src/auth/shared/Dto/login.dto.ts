import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
export class LoginUserDto {
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @IsEmail({}, { message: i18nValidationMessage('validation.INVALID_EMAIL') })
  @Transform(({ value }: { value: string }) => value.toString().trim(), {
    toClassOnly: true,
  })
  email!: string;

  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @IsString()
  @MinLength(6, {
    message: 'The password must be at least 6 characters long.',
  })
  @MaxLength(32, { message: 'The password must be at most 32 characters.' })
  @Transform(({ value }: { value: string }) => value.toString().trim(), {
    toClassOnly: true,
  })
  password!: string;
}
