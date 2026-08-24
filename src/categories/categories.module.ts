import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from './shared/schemas/category.schema';
import {
  SubCategory,
  SubCategorySchema,
} from 'src/sub-category/shared/schemas/sub-category.schema';

import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { AuthModule } from 'src/auth/auth.module';
import { CategoriesStatisticsService } from './categories-helper/categories-statistics.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: SubCategory.name, schema: SubCategorySchema },
    ]),
  ],
  controllers: [CategoriesController],
  providers: [
    CategoriesService,
    CategoriesStatisticsService,
  ],
  exports: [MongooseModule],
})
export class CategoriesModule {}
