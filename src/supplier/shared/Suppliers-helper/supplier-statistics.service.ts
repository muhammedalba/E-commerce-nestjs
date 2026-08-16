import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Supplier, SupplierDocument } from '../schema/Supplier.schema';

@Injectable()
export class SupplierStatistics {
  constructor(
    @InjectModel(Supplier.name) private supplierModel: Model<SupplierDocument>,
  ) {}

  async suppliers_statistics() {
    // إجمالي الموردين وعدد حسب الحالة
    const totalSuppliers = await this.supplierModel.countDocuments();

    const suppliersByStatus = await this.supplierModel.aggregate([
      {
        $group: {
          _id: '$isActive',
          count: { $sum: 1 },
        },
      },
    ]);

    // تفاصيل الموردين مع المنتجات وعددها
    const suppliersWithProducts = await this.supplierModel.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'supplier',
          as: 'products',
        },
      },
      {
        $project: {
          supplierId: '$_id',
          supplierName: '$name',
          status: 1,
          totalProducts: { $size: '$products' },
          products: {
            $map: {
              input: '$products',
              as: 'prod',
              in: {
                productId: '$$prod._id',
                title: '$$prod.title.en',
                price: '$$prod.price',
              },
            },
          },
        },
      },
    ]);

    return {
      totalSuppliers,
      suppliersByStatus,
      suppliersWithProducts,
    };
  }
}
