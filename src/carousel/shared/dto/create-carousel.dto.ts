import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsDefined,
  ValidateNested,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

export class CreateCarouselDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  description!: FieldLocalizeDto;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsOptional()
  @IsString({ message: 'validation.IS_String' })
  carouselSm!: string;

  @IsOptional()
  @IsString({ message: 'validation.IS_String' })
  carouselMd!: string;

  @IsOptional()
  @IsString({ message: 'validation.IS_String' })
  carouselLg!: string;
}
