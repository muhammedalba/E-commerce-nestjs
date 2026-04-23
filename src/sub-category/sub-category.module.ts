import { Module } from '@nestjs/common';
import { SubCategoryService } from './sub-category.service';
import { SubCategoryController } from './sub-category.controller';
import { AuthModule } from 'src/auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SubCategory,
  SubCategorySchema,
} from './shared/schemas/sub-category.schema';
import { SubCategoriesStatistics } from './shared/sub-categories-helper/sub-categories-statistics.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import {
  Category,
  CategorySchema,
} from 'src/categories/shared/schemas/category.schema';
import { FileUploadDiskStorageModule } from 'src/file-upload/file-upload.module';
@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: SubCategory.name,
        useFactory() {
          const schema = SubCategorySchema;

          return schema;
        },
      },
      {
        name: Category.name,
        useFactory: () => {
          return CategorySchema;
        },
      },
    ]),
    AuthModule,
    FileUploadDiskStorageModule,
  ],
  controllers: [SubCategoryController],
  providers: [SubCategoryService, CustomI18nService, SubCategoriesStatistics],
  exports: [MongooseModule],
})
export class SubCategoryModule {}
