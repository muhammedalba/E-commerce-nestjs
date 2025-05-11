import { Module } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Brand, BrandSchema } from './schemas/brand.schema';
import * as mongooseI18n from 'mongoose-i18n-localize';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    FileUploadDiskStorageModule,
    MongooseModule.forFeatureAsync([
      {
        name: Brand.name,
        useFactory() {
          const schema = BrandSchema;
          schema.plugin(mongooseI18n, {
            locales: process.env.LANGUAGES?.split(',') ?? ['ar', 'en'],
            defaultLocale: process.env.DEFAULT_LANGUAGE ?? 'ar',
            textCase: 'lowercase',
            autoPopulate: true,
            indexes: {
              name: 1,
              slug: 1,
            },
          });
          return schema;
        },
      },
    ]),
    AuthModule,
  ],
  controllers: [BrandsController],
  providers: [BrandsService, CustomI18nService],
})
export class BrandsModule {}
