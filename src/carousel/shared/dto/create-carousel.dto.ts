import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsDefined,
  ValidateNested,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';
import { FileAsset } from 'src/shared/schema/file-asset.schema';

export class CreateCarouselDto {
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  description!: FieldLocalizeDto;

  @IsOptional()
  @IsString({ message: 'validation.IS_String' })
  slug?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsOptional()
  carouselSm?: FileAsset;

  @IsOptional()
  carouselMd?: FileAsset;

  @IsOptional()
  carouselLg?: FileAsset;
}
