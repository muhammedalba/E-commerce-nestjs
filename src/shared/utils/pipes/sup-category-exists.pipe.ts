import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SupCategory } from 'src/sup-category/shared/schemas/sup-category.schema';

@Injectable()
export class SupCategoryExistsPipe implements PipeTransform {
  constructor(
    @InjectModel(SupCategory.name)
    private readonly supCategoryModel: Model<SupCategory>,
  ) {}

  async transform(value: string[] | null): Promise<string[] | null> {
    if (!value || !Array.isArray(value) || value.length === 0) return [];

    const existing = await this.supCategoryModel
      .find({ _id: { $in: value } })
      .select('_id');

    const existingIds = existing.map((doc) => doc._id.toString());

    const notFound = value.filter((id) => !existingIds.includes(id));
    if (notFound.length > 0) {
      throw new BadRequestException(
        `SupCategories not found: ${notFound.join(', ')}`,
      );
    }

    return value;
  }
}
