import { Module } from '@nestjs/common';
import { CarouselService } from './carousel.service';
import { CarouselController } from './carousel.controller';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Carousel, CarouselSchema } from './shared/schemas/carousel.schema';
import * as mongooseI18n from 'mongoose-i18n-localize';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
@Module({
  imports: [
    FileUploadDiskStorageModule,
    MongooseModule.forFeatureAsync([
      {
        name: Carousel.name,
        useFactory() {
          const schema = CarouselSchema;
          schema.plugin(mongooseI18n, {
            locales: process.env.LANGUAGES?.split(',') ?? ['ar', 'en'],
            defaultLocale: process.env.DEFAULT_LANGUAGE ?? 'ar',
            textCase: 'lowercase',
            autoPopulate: true,
            indexes: {
              description: 1,
            },
          });
          return schema;
        },
      },
    ]),
  ],
  controllers: [CarouselController],
  providers: [CarouselService, CustomI18nService],
})
export class CarouselModule {}
