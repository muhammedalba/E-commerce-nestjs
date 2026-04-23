import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PromoBanner,
  PromoBannerSchema,
} from './shared/schema/promo-banner.schema';
import { PromoBannerService } from './promo-banner.service';
import { PromoBannerController } from './promo-banner.controller';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: PromoBanner.name,
        useFactory() {
          return PromoBannerSchema;
        },
      },
    ]),
  ],
  controllers: [PromoBannerController],
  providers: [CustomI18nService, PromoBannerService],
})
export class PromoBannerModule {}
