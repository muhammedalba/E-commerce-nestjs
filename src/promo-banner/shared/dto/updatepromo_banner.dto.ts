import { PartialType } from '@nestjs/mapped-types';
import { PromoBannerDto } from './promo-banner.dto';

export class UpdatePromoBannerDto extends PartialType(PromoBannerDto) {}
