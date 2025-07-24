import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PromoBannerLocalizeDto {
  @ApiProperty({
    description: 'Arabic localized string for the promo banner',
    example: 'نص إعلاني بالعربية',
  })
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @IsString({ message: 'validation.NOT_EMPTY' })
  @Length(3, 400, {
    message: 'validation.LANG_CODE_LENGTH',
  })
  @Transform(({ value }: TransformFnParams) => {
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  ar!: string;

  @ApiProperty({
    description: 'English localized string for the promo banner',
    example: 'Promotional text in English',
  })
  @IsString({ message: 'validation.NOT_EMPTY' })
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @Transform(({ value }: TransformFnParams) => {
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  @Length(3, 400, {
    message: 'validation.LANG_CODE_LENGTH',
  })
  en!: string;
}
