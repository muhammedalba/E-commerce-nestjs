import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Brand } from '../schemas/brand.schema';

@Injectable()
export class BrandsStatistics {
  constructor(
    @InjectModel(Brand.name) private readonly brandModel: Model<Brand>,
  ) {}

  async statistics() {
    const totalBrands = await this.brandModel.countDocuments();
    return { status: 'success', data: totalBrands };
  }
}
