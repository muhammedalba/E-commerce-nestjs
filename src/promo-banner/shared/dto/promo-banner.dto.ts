import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { PromoBannerLocalizeDto } from 'src/shared/utils/PromoBanner-ocolaized.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromoBannerDto {
  @ApiProperty({
    description: 'Localized text for the promo banner',
    type: () => PromoBannerLocalizeDto,
  })
  @IsDefined()
  @Type(() => PromoBannerLocalizeDto)
  @ValidateNested()
  text!: PromoBannerLocalizeDto;

  @ApiPropertyOptional({
    description: 'Whether the promo banner is active',
    type: Boolean,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
