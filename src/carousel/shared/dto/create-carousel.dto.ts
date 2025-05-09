// carouselImage;
import { Type } from 'class-transformer';
import {
  IsString,
  IsDefined,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

export class CreateCarouselDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  //   validaate opject in opject
  @ValidateNested()
  description!: FieldLocalizeDto;

  @IsOptional()
  @IsString({ message: 'validation.IS_String' })
  image!: string;
}
