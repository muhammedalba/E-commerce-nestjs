import { Module } from '@nestjs/common';
import { SupCategoryService } from './sup-category.service';
import { SupCategoryController } from './sup-category.controller';
import { AuthModule } from 'src/auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SupCategory,
  SupCategorySchema,
} from './shared/schemas/sup-category.schema';
import * as mongooseI18n from 'mongoose-i18n-localize';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import { SupCategoriesStatistics } from './shared/sup-categories-helper/sup-categories-statistics.service';
@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: SupCategory.name,
        useFactory() {
          const schema = SupCategorySchema;
          schema.plugin(mongooseI18n, {
            locales: process.env.LANGUAGES?.split(',') ?? ['ar', 'en'],
            defaultLocale: process.env.DEFAULT_LANGUAGE ?? 'ar',
            textCase: 'lowercase',
            autoPopulate: true,
            indexes: {
              'name.ar': 1,
              'name.en': 1,
              slug: 1,
            },
          });
          return schema;
        },
      },
    ]),
    AuthModule,
    FileUploadDiskStorageModule,
  ],
  controllers: [SupCategoryController],
  providers: [SupCategoryService, CustomI18nService, SupCategoriesStatistics],
  exports: [MongooseModule],
})
export class SupCategoryModule {}
