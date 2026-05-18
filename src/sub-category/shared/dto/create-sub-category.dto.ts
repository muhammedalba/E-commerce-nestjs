import { Type } from 'class-transformer';
import {
  IsString,
  IsDefined,
  ValidateNested,
  IsMongoId,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

export class CreateSubCategoryDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  name!: FieldLocalizeDto;

  @IsString({ message: 'validation.IS_String' })
  @IsMongoId()
  @Exists(MODEL_NAMES.CATEGORY)
  category!: string;
}
