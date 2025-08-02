import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsDefined,
  ValidateNested,
  IsMongoId,
  IsArray,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Localized name of the category',
    type: () => FieldLocalizeDto,
    example: { en: 'Category Name (English)', ar: 'اسم الفئة (العربية)' },
  })
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  name!: FieldLocalizeDto;

  @ApiPropertyOptional({
    description: 'Image file for the category (Max 1MB, formats: png, jpeg, webp)',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  @IsString({ message: 'validation.IS_String' })
  image?: string;

  // @ApiPropertyOptional({
  //   description: 'Array of sub-category IDs related to this category',
  //   type: [String],
  //   example: ['60d21b4667d0d8992e610c85', '60d21b4667d0d8992e610c86'],
  // })
  // @IsArray()
  // @IsMongoId({
  //   each: true,
  //   message: 'كل عنصر في supCategories يجب أن يكون MongoId',
  // })
  // @IsOptional()
  // supCategories?: string[];
}
