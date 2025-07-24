import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FieldLocalizeDto {
  @ApiProperty({
    description: 'Arabic localized string',
    example: 'مرحباً',
  })
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @IsString({ message: 'validation.NOT_EMPTY' })
  @Length(3, 70, {
    message: 'validation.LANG_CODE_LENGTH',
  })
  @Transform(({ value }: TransformFnParams) => {
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  ar!: string;

  @ApiProperty({
    description: 'English localized string',
    example: 'Hello',
  })
  @IsString({ message: 'validation.NOT_EMPTY' })
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @Transform(({ value }: TransformFnParams) => {
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  @Length(3, 70, {
    message: 'validation.LANG_CODE_LENGTH',
  })
  en!: string;
}
