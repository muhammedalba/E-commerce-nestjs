import { Type } from 'class-transformer';
import {
  IsString,
  IsDefined,
  ValidateNested,
  IsMongoId,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Category } from 'src/categories/shared/schemas/category.schema';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';

export class CreateSubCategoryDto {

  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  name!: FieldLocalizeDto;

  @IsString({ message: 'validation.IS_String' })
  @IsMongoId()
  @Exists(Category.name)
  category!: string;
}
