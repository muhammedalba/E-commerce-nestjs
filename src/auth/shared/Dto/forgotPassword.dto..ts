import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsNotEmpty({
    message: 'email is require',
  })
  @Transform(({ value }: { value: string }) => value.trim(), {
    toClassOnly: true,
  })
  @IsEmail({}, { message: 'email must be a valid email' })
  email!: string;
}
