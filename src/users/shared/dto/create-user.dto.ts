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

export class CreateUserDto {
  @ApiProperty({
    description: 'The name of the user.',
    example: 'John Doe',
  })
  @IsNotEmpty({ message: 'الاسم مطلوب' })
  @IsString({ message: 'يجب أن يكون الاسم نصًا' })
  @MinLength(4, { message: 'يجب أن يكون الاسم على الأقل 4 أحرف' })
  @MaxLength(30, { message: 'يجب أن يكون الاسم على الأكثر 30 حرفًا' })
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
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email!: string;

  @ApiProperty({
    description: 'The password of the user.',
    example: 'password123',
  })
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @IsString({ message: 'يجب أن تكون كلمة المرور نصًا' })
  @MinLength(6, { message: 'يجب أن تكون كلمة المرور على الأقل 6 أحرف' })
  @MaxLength(32, { message: 'يجب أن تكون كلمة المرور على الأكثر 32 حرفًا' })
  @Validate(MatchPasswordValidator)
  password!: string;

  @ApiProperty({
    description: 'The password confirmation.',
    example: 'password123',
  })
  @IsNotEmpty({ message: 'تأكيد كلمة المرور مطلوب' })
  @IsString({ message: 'يجب أن يكون تأكيد كلمة المرور نصًا' })
  @MinLength(6, { message: 'يجب أن يكون تأكيد كلمة المرور على الأقل 6 أحرف' })
  @MaxLength(32, {
    message: 'يجب أن يكون تأكيد كلمة المرور على الأكثر 32 حرفًا',
  })
  @Validate(MatchPasswordValidator)
  confirmPassword!: string;

  @ApiPropertyOptional({
    description: 'The role of the user.',
    enum: roles,
    default: roles.USER,
  })
  @IsOptional()
  @IsEnum(roles, {
    message: 'يجب أن تكون الصلاحية إما admin أو user أو manager',
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
