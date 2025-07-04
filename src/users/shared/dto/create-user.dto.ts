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

export class CreateUserDto {
  @IsNotEmpty({ message: 'الاسم مطلوب' })
  @IsString({ message: 'يجب أن يكون الاسم نصًا' })
  @MinLength(4, { message: 'يجب أن يكون الاسم على الأقل 4 أحرف' })
  @MaxLength(30, { message: 'يجب أن يكون الاسم على الأكثر 30 حرفًا' })
  name!: string;
  @IsString()
  @IsOptional()
  slug!: string;
  @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email!: string;

  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @IsString({ message: 'يجب أن تكون كلمة المرور نصًا' })
  @MinLength(6, { message: 'يجب أن تكون كلمة المرور على الأقل 6 أحرف' })
  @MaxLength(32, { message: 'يجب أن تكون كلمة المرور على الأكثر 32 حرفًا' })
  @Validate(MatchPasswordValidator)
  password!: string;

  @IsNotEmpty({ message: 'تأكيد كلمة المرور مطلوب' })
  @IsString({ message: 'يجب أن يكون تأكيد كلمة المرور نصًا' })
  @MinLength(6, { message: 'يجب أن يكون تأكيد كلمة المرور على الأقل 6 أحرف' })
  @MaxLength(32, {
    message: 'يجب أن يكون تأكيد كلمة المرور على الأكثر 32 حرفًا',
  })
  @Validate(MatchPasswordValidator)
  confirmPassword!: string;

  @IsOptional()
  @IsEnum(roles, {
    message: 'يجب أن تكون الصلاحية إما admin أو user أو manager',
  })
  @IsLowercase()
  role?: roles;

  @IsOptional()
  avatar?: string;
}
