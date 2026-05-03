import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsOptional,
  ValidateNested,
  IsString,
} from 'class-validator';
import { PromoBannerLocalizeDto } from 'src/shared/utils/PromoBanner-ocolaized.dto';

export class PromoBannerDto {
  @IsDefined()
  @Type(() => PromoBannerLocalizeDto)
  @ValidateNested()
  text!: PromoBannerLocalizeDto;

  @IsString()
  @IsOptional()
  link?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}
