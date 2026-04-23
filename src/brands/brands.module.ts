import { Module } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { FileUploadDiskStorageModule } from 'src/file-upload/file-upload.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Brand, BrandSchema } from './shared/schemas/brand.schema';

import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { AuthModule } from 'src/auth/auth.module';
import { BrandsStatistics } from './shared/brands-helper/brands-statistics.service';

@Module({
  imports: [
    FileUploadDiskStorageModule,
    MongooseModule.forFeatureAsync([
      {
        name: Brand.name,
        useFactory() {
          return BrandSchema;
        },
      },
    ]),
    AuthModule,
  ],
  controllers: [BrandsController],
  providers: [BrandsService, CustomI18nService, BrandsStatistics],
  exports: [MongooseModule],
})
export class BrandsModule {}
