import { Type } from 'class-transformer';
import {
  IsString,
  IsDefined,
  ValidateNested,
  IsMongoId,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupCategoryDto {
  @ApiProperty({
    description: 'Localized name of the sub-category',
    type: () => FieldLocalizeDto,
    example: { en: 'Sub-Category Name (English)', ar: 'اسم الفئة الفرعية (العربية)' },
  })
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  name!: FieldLocalizeDto;

  @ApiProperty({
    description: 'ID of the parent category',
    example: '60d21b4667d0d8992e610c85',
  })
  @IsString({ message: 'validation.IS_String' })
  @IsMongoId()
  category!: string;
}
