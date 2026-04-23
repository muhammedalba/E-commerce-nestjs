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
} from 'class-validator';
import { MatchPasswordValidator } from '../validators/match-password.validator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateUserDto {
  @ApiProperty({
    description: 'The name of the user.',
    example: 'John Doe',
  })
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(4, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(30, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  name!: string;

  @ApiPropertyOptional({
    description: 'The slug for the user.',
    example: 'john-doe',
  })
  @IsString()
  @IsOptional()
  slug!: string;

  @ApiProperty({
    description: 'The email of the user.',
    example: 'john.doe@example.com',
  })
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsEmail({}, { message: i18nValidationMessage('validation.INVALID_EMAIL') })
  email!: string;

  @ApiProperty({
    description: 'The password of the user.',
    example: 'password123',
  })
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(6, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(32, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Validate(MatchPasswordValidator)
  password!: string;

  @ApiProperty({
    description: 'The password confirmation.',
    example: 'password123',
  })
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @IsString({ message: i18nValidationMessage('validation.IS_String') })
  @MinLength(6, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(32, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Validate(MatchPasswordValidator)
  confirmPassword!: string;

  @ApiPropertyOptional({
    description: 'The role of the user.',
    enum: roles,
    default: roles.USER,
  })
  @IsOptional()
  @IsEnum(roles, {
    message: i18nValidationMessage('validation.IS_ENUM'),
  })
  @IsLowercase()
  role?: roles;

  @ApiPropertyOptional({
    description: 'The avatar of the user.',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  avatar?: string;
}
