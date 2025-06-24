import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PromoBanner,
  PromoBannerSchema,
} from './shared/schema/promo-banner.schema';
import { PromoBannerService } from './promo-banner.service';
import { PromoBannerController } from './promo-banner.controller';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import * as mongooseI18n from 'mongoose-i18n-localize';
@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: PromoBanner.name,
        useFactory() {
          const schema = PromoBannerSchema;
          schema.plugin(mongooseI18n, {
            locales: process.env.LANGUAGES?.split(',') ?? ['ar', 'en'],
            defaultLocale: process.env.DEFAULT_LANGUAGE ?? 'ar',
            textCase: 'lowercase',
            autoPopulate: true,
          });
          return schema;
        },
      },
    ]),
  ],
  controllers: [PromoBannerController],
  providers: [CustomI18nService, PromoBannerService],
})
export class PromoBannerModule {}
