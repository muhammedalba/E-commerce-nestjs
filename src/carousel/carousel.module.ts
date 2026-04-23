import { Module } from '@nestjs/common';
import { CarouselService } from './carousel.service';
import { CarouselController } from './carousel.controller';
import { FileUploadDiskStorageModule } from 'src/file-upload/file-upload.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Carousel, CarouselSchema } from './shared/schemas/carousel.schema';

import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { AuthModule } from 'src/auth/auth.module';
@Module({
  imports: [
    FileUploadDiskStorageModule,
    MongooseModule.forFeatureAsync([
      {
        name: Carousel.name,
        useFactory() {
          return CarouselSchema;
        },
      },
    ]),
    AuthModule,
  ],
  controllers: [CarouselController],
  providers: [CarouselService, CustomI18nService],
})
export class CarouselModule {}
