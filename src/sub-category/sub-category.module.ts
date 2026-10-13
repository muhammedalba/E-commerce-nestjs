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
import {
  Category,
  CategorySchema,
} from 'src/categories/shared/schemas/category.schema';
import {
  Product,
  ProductSchema,
} from 'src/products/shared/schemas/Product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubCategory.name, schema: SubCategorySchema },
      { name: Category.name, schema: CategorySchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    AuthModule,
  ],
  controllers: [SubCategoryController],
  providers: [SubCategoryService, SubCategoriesStatistics],
  exports: [MongooseModule],
})
export class SubCategoryModule {}
