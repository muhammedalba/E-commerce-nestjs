import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsDefined,
  ValidateNested,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBrandDto {
  @ApiProperty({
    description: 'Localized name of the brand',
    type: () => FieldLocalizeDto,
    example: { en: 'Brand Name (English)', ar: 'اسم الماركة (العربية)' },
  })
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  name!: FieldLocalizeDto;

  @ApiProperty({
    description: 'Image file for the brand (Max 1MB, formats: png, jpeg, webp)',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  @IsString({ message: 'validation.IS_String' })
  image?: string;
}
