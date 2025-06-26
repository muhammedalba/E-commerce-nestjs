// pipes/brand-exists.pipe.ts
import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Brand } from 'src/brands/shared/schemas/brand.schema';

@Injectable()
export class BrandExistsPipe implements PipeTransform {
  constructor(
    @InjectModel(Brand.name)
    private readonly brandModel: Model<Brand>,
  ) {}

  async transform(value: string): Promise<Types.ObjectId | null> {
    if (!value) return null;

    const exists = await this.brandModel.exists({ _id: value });
    if (!exists) {
      throw new BadRequestException('Brand not found');
    }

    return new Types.ObjectId(value);
  }
}
