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
    // Explicit isActive filter bypasses the schema's "hide inactive" hook, so the
    // total matches suppliersByStatus below (null also matches a missing field)
    const totalSuppliers = await this.supplierModel.countDocuments({
      isActive: { $in: [true, false, null] },
    });

    const suppliersByStatus = await this.supplierModel.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$isActive', true] }, // missing field = active, as in the schema hook
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
