import { Type } from 'class-transformer';
import {
  IsString,
  IsDefined,
  ValidateNested,
  IsMongoId,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
export class CreateSupCategoryDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  //   validate object in object
  @ValidateNested()
  name!: FieldLocalizeDto;

  @IsString({ message: 'validation.IS_String' })
  @IsMongoId()
  category!: string;
}
