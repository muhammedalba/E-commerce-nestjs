import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsDefined,
  ValidateNested,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

export class CreateBrandDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  //   validaate opject in opject
  @ValidateNested()
  name!: FieldLocalizeDto;

  @IsOptional()
  @IsString({ message: 'validation.NOT_EMPTY' })
  image?: string;
}
