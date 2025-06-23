import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Category } from '../shared/schemas/category.schema';

@Injectable()
export class CategoriesStatistics {
  constructor(
    @InjectModel(Category.name) private readonly CategoryModel: Model<Category>,
  ) {}

  async categoriesStatistics() {
    const totalCategories = await this.CategoryModel.countDocuments();
    return { status: 'success', data: totalCategories };
  }
}
