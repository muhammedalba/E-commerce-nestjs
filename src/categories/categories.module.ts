import { Module } from '@nestjs/common';
import { FileUploadDiskStorageModule } from 'src/file-upload/file-upload.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from './shared/schemas/category.schema';

import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { AuthModule } from 'src/auth/auth.module';
import { CategoriesStatisticsService } from './categories-helper/categories-statistics.service';

@Module({
  imports: [
    AuthModule,
    FileUploadDiskStorageModule,
    MongooseModule.forFeatureAsync([
      {
        name: Category.name,
        useFactory() {
          return CategorySchema;
        },
      },
    ]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService, CustomI18nService, CategoriesStatisticsService],
  exports: [MongooseModule],
})
export class CategoriesModule {}
