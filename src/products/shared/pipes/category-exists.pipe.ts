// pipes/category-exists.pipe.ts
import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from 'src/categories/shared/schemas/category.schema';

@Injectable()
export class CategoryExistsPipe implements PipeTransform {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
  ) {}

  async transform(
    value: string | number | null,
  ): Promise<string | number | null> {
    if (!value) return null;

    const exists = await this.categoryModel.exists({ _id: value });
    if (!exists) {
      throw new BadRequestException('Category not found');
    }

    return value;
  }
}
