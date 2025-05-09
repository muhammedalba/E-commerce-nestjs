import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsDefined,
  ValidateNested,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

export class CreateCategoryDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  //   validate object in object
  @ValidateNested()
  name!: FieldLocalizeDto;

  @IsOptional()
  @IsString({ message: 'validation.IS_String' })
  image?: string;
}
