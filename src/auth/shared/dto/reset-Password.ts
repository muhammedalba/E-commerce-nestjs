import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  Length,
} from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @IsEmail({}, { message: 'validation.INVALID_EMAIL' })
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

  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @IsString({
    message: 'reset code must be a string',
  })
  @Length(6, 6, { message: 'reset code must be 6 characters long' })
  @Transform(({ value }: { value: string }) => value.trim(), {
    toClassOnly: true,
  })
  passwordResetCode!: string;
}
