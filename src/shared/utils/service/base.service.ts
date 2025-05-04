import { NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { CustomI18nService } from '../i18n/costum-i18n-service';
import { ApiFeatures } from '../ApiFeatures';
import { QueryString } from '../interfaces/queryInterface';
export class BaseService<T> {
  constructor(
    protected readonly model: Model<T>,
    protected readonly i18n: CustomI18nService,
  ) {}

  async create(doc: any): Promise<T> {
    return await this.model.create(doc);
  }

  async findAll(modelName: string, QueryDto: QueryString) {
    const total = await this.model.countDocuments();

    const features = new ApiFeatures(this.model.find(), QueryDto)
      .filter()
      .search(modelName)
      .sort()
      .limitFields()
      .paginate(total);

    const data = await features.getQuery();

    return {
      status: 'success',
      pagination: features.getPagination(),
      data,
    };
  }

  async findById(id: string): Promise<{ status: string; data: T }> {
    const doc = await this.model.findById(id).select('-__v ').lean();
    if (!doc) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }

    return {
      status: 'success',
      data: doc as T,
    };
  }

  async update(id: string, update: any): Promise<T> {
    return (await this.model
      .findByIdAndUpdate(id, update, { new: true })
      .exec()) as T;
  }

  async delete(id: string): Promise<any> {
    // 1) check  user if found
    const doc = await this.model.exists({ _id: id });
    if (!doc) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    // 2) delete  doc from the database
    await this.model.deleteOne({ _id: doc._id });
    return;
  }
}
