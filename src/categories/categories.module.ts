import { Module } from '@nestjs/common';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from './shared/schemas/category.schema';
import * as mongooseI18n from 'mongoose-i18n-localize';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [
    FileUploadDiskStorageModule,
    MongooseModule.forFeatureAsync([
      {
        name: Category.name,
        useFactory() {
          const schema = CategorySchema;
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
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService, CustomI18nService],
})
export class CategoriesModule {}
