import { Model } from 'mongoose';
import { startOfMonth, endOfMonth, subDays, startOfDay } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Product } from '../shared/schemas/Product.schema';
import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class ProductsStatistics {
  constructor(
    @InjectModel(Product.name) private readonly ProductModel: Model<Product>,
  ) {}

  async Products_statistics(
    sortBy: 'sold' | 'ratingsAverage' | 'quantity' = 'sold',
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

        this.ProductModel.aggregate([
          {
            $addFields: {
              sortField:
                sortBy === 'sold'
                  ? '$sold'
                  : sortBy === 'ratingsAverage'
                    ? '$ratingsAverage'
                    : '$quantity',
            },
          },
          { $sort: { sortField: -1 } },
          { $limit: 5 },
          {
            $project: {
              _id: 0,
              productId: '$_id',
              productName: `$title.${lang}`,
              sold: 1,
              ratingsAverage: 1,
              quantity: 1,
              price: 1,
            },
          },
        ]),

        // عدد المنتجات التي المخزون فيها أقل من 15
        this.ProductModel.countDocuments({ quantity: { $lt: 15 } }),

        // قائمة بأهم 5 منتجات قليلة المخزون (أقل من 15)
        this.ProductModel.aggregate([
          { $match: { quantity: { $lt: 15 } } },
          {
            $addFields: {
              sortField:
                sortBy === 'sold'
                  ? '$sold'
                  : sortBy === 'ratingsAverage'
                    ? '$ratingsAverage'
                    : '$quantity',
            },
          },
          { $sort: { sortField: 1 } }, // نرتب تصاعديًا عشان نعرض الأقل كمية أولًا
          { $limit: 5 },
          {
            $project: {
              _id: 0,
              productId: '$_id',
              productName: `$title.${lang}`,
              sold: 1,
              ratingsAverage: 1,
              quantity: 1,
              price: 1,
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
