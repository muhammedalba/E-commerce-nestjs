import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { PromoBannerLocalizeDto } from 'src/shared/utils/PromoBanner-ocolaized.dto';

export class PromoBannerDto {
  @IsDefined()
  @Type(() => PromoBannerLocalizeDto)
  //   validaate opject in opject
  @ValidateNested()
  text!: PromoBannerLocalizeDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
