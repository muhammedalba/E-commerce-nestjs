import { Type } from 'class-transformer';
import {
  IsString,
  IsDefined,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCarouselDto {
  @ApiProperty({
    description: 'Localized description of the carousel item',
    type: () => FieldLocalizeDto,
    example: { en: 'Carousel Description (English)', ar: 'وصف الكاروسيل (العربية)' },
  })
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  description!: FieldLocalizeDto;

  @ApiProperty({
    description: 'Small carousel image file (Max 1MB, formats: png, jpeg, webp)',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  @IsString({ message: 'validation.IS_String' })
  carouselSm!: string;

  @ApiProperty({
    description: 'Medium carousel image file (Max 1MB, formats: png, jpeg, webp)',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  @IsString({ message: 'validation.IS_String' })
  carouselMd!: string;

  @ApiProperty({
    description: 'Large carousel image file (Max 1MB, formats: png, jpeg, webp)',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  @IsString({ message: 'validation.IS_String' })
  carouselLg!: string;
}
