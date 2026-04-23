import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SupCategory } from '../schemas/sup-category.schema';

@Injectable()
export class SupCategoriesStatistics {
  constructor(
    @InjectModel(SupCategory.name)
    private readonly SupCategoryModel: Model<SupCategory>,
  ) {}

  async supCategoriesStatistics() {
    const totalCategories = await this.SupCategoryModel.countDocuments();
    return { status: 'success', data: totalCategories };
  }
}
