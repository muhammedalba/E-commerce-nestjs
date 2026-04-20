import { Model } from 'mongoose';
import { startOfMonth, endOfMonth, subDays, startOfDay } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Product } from '../shared/schemas/Product.schema';
import { ProductVariant } from '../shared/schemas/ProductVariant.schema';
import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class ProductsStatistics {
  constructor(
    @InjectModel(Product.name) private readonly ProductModel: Model<Product>,
    @InjectModel(ProductVariant.name)
    private readonly VariantModel: Model<ProductVariant>,
  ) {}

  async Products_statistics(
    sortBy: 'sold' | 'ratingsAverage' | 'stock' = 'sold',
  ) {
    const lang =
      I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    try {
      const today: Date = new Date();
      const startMonth = startOfMonth(today);
      const endMonth = endOfMonth(today);
      const start7DaysAgo = subDays(startOfDay(today), 6);

      const [
        totalProducts,
        statusCounts,
        currentMonthProducts,
        dailyNewProductsRaw,
        topProductsRaw,
        lowStockCount,
        lowStockProductsRaw,
        variantStats,
      ] = await Promise.all([
        this.ProductModel.countDocuments(),

        this.ProductModel.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        this.ProductModel.countDocuments({
          createdAt: { $gte: startMonth, $lte: endMonth },
        }),

        this.ProductModel.aggregate([
          {
            $match: {
              createdAt: { $gte: start7DaysAgo },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // Top products by variant sales (aggregated)
        this.VariantModel.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          {
            $group: {
              _id: '$productId',
              totalSold: { $sum: '$sold' },
              totalStock: { $sum: '$stock' },
              minPrice: { $min: '$price' },
              maxPrice: { $max: '$price' },
              variantCount: { $sum: 1 },
            },
          },
          { $sort: { totalSold: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'products',
              localField: '_id',
              foreignField: '_id',
              as: 'product',
            },
          },
          { $unwind: '$product' },
          {
            $project: {
              _id: 0,
              productId: '$_id',
              productName: `$product.title.${lang}`,
              totalSold: 1,
              totalStock: 1,
              minPrice: 1,
              maxPrice: 1,
              variantCount: 1,
            },
          },
        ]),

        // Low stock variants count (stock < 15)
        this.VariantModel.countDocuments({
          stock: { $lt: 15 },
          isDeleted: { $ne: true },
        }),

        // Low stock variants details
        this.VariantModel.aggregate([
          { $match: { stock: { $lt: 15 }, isDeleted: { $ne: true } } },
          { $sort: { stock: 1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: '_id',
              as: 'product',
            },
          },
          { $unwind: '$product' },
          {
            $project: {
              _id: 0,
              variantId: '$_id',
              productId: '$productId',
              productName: `$product.title.${lang}`,
              sku: 1,
              stock: 1,
              sold: 1,
              price: 1,
              attributes: 1,
              label: 1,
            },
          },
        ]),

        // Overall variant stats
        this.VariantModel.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          {
            $group: {
              _id: null,
              totalVariants: { $sum: 1 },
              totalStock: { $sum: '$stock' },
              totalSold: { $sum: '$sold' },
              avgPrice: { $avg: '$price' },
            },
          },
        ]),
      ]);

      const statusBreakdown = statusCounts.reduce<Record<string, number>>(
        (acc, curr: { _id: string; count: number }) => {
          acc[curr._id] = curr.count;
          return acc;
        },
        {},
      );

      const dailyNewProducts = dailyNewProductsRaw.map(
        (entry: { _id: string; count: number }) => ({
          date: entry._id,
          count: entry.count,
        }),
      );

      return {
        status: 'success',
        data: {
          totalProducts,
          statusBreakdown,
          currentMonthProducts,
          dailyNewProducts,
          topProducts: topProductsRaw,
          lowStockCount,
          lowStockProducts: lowStockProductsRaw,
          variantStats: variantStats[0] ?? {
            totalVariants: 0,
            totalStock: 0,
            totalSold: 0,
            avgPrice: 0,
          },
          sortedBy: sortBy,
          lang,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to fetch products statistics.',
        error,
      };
    }
  }
}
