// pipes/brand-exists.pipe.ts
import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Supplier } from 'src/supplier/shared/schema/Supplier.schema';

@Injectable()
export class SupplierExistsPipe implements PipeTransform {
  constructor(
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<Supplier>,
  ) {}

  async transform(value: string): Promise<Types.ObjectId | null> {
    if (!value) return null;

    const exists = await this.supplierModel.exists({ _id: value });
    if (!exists) {
      throw new BadRequestException('Supplier not found');
    }

    return new Types.ObjectId(value);
  }
}
