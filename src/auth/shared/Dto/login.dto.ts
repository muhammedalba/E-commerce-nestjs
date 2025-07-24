import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class LoginUserDto {
  @ApiProperty({
    description: 'The email of the user',
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @IsEmail({}, { message: 'validation.INVALID_EMAIL' })
  @Transform(({ value }: { value: string }) => value.toString().trim(), {
    toClassOnly: true,
  })
  email!: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'password123',
  })
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
