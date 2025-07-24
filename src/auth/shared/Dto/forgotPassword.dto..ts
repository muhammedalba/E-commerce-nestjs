import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'The email address to send the password reset link to',
    example: 'user@example.com',
  })
  @IsNotEmpty({
    message: 'email is require',
  })
  @Transform(({ value }: { value: string }) => value.trim(), {
    toClassOnly: true,
  })
  @IsEmail({}, { message: 'email must be a valid email' })
  email!: string;
}
