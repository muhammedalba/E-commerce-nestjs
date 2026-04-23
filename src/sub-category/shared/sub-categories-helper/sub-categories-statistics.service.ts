import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SubCategory } from '../schemas/sub-category.schema';

@Injectable()
export class SubCategoriesStatistics {
  constructor(
    @InjectModel(SubCategory.name)
    private readonly SubCategoryModel: Model<SubCategory>,
  ) {}

  async SubCategoriesStatistics() {
    const totalCategories = await this.SubCategoryModel.countDocuments();
    return { status: 'success', data: totalCategories };
  }
}
