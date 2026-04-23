import { Model } from 'mongoose';
import { startOfMonth, endOfMonth, subDays, startOfDay } from 'date-fns';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Product } from '../shared/schemas/Product.schema';
import { ProductVariant } from '../shared/schemas/ProductVariant.schema';
import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class ProductsStatistics {
  constructor(
    @InjectModel(Product.name) private readonly ProductModel: Model<Product>,
    @InjectModel(ProductVariant.name)
    private readonly VariantModel: Model<ProductVariant>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async Products_statistics(
    startDate?: string,
    endDate?: string,
    sortBy: 'sold' | 'ratingsAverage' | 'stock' = 'sold',
  ) {
    const lang =
      I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';

    // Check cache first
    const cacheKey = `products:statistics:${lang}:${sortBy}:${startDate}:${endDate}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    try {
      const today: Date = new Date();
      const start = startDate ? new Date(startDate) : startOfMonth(today);
      const end = endDate ? new Date(endDate) : endOfMonth(today);
      const start7DaysAgo = subDays(startOfDay(today), 6);
      const start30DaysAgo = subDays(startOfDay(today), 29);

      const [
        totalProducts,
        statusCounts,
        currentMonthProducts,
        dailyNewProductsRaw,
        topProductsRaw,
        lowStockCount,
        lowStockProductsRaw,
        variantStats,
        compositionRaw,
        categoryDistributionRaw,
        last30DaysRaw,
      ] = await Promise.all([
        this.ProductModel.countDocuments(),

        this.ProductModel.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        this.ProductModel.countDocuments({
          createdAt: { $gte: start, $lte: end },
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

        // Overall variant stats + Portfolio Value
        this.VariantModel.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          {
            $group: {
              _id: null,
              totalVariants: { $sum: 1 },
              totalStock: { $sum: '$stock' },
              totalSold: { $sum: '$sold' },
              totalValue: { $sum: { $multiply: ['$price', '$stock'] } },
              avgPrice: { $avg: '$price' },
            },
          },
        ]),

        // Composition: Simple vs Variable
        this.ProductModel.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          {
            $group: {
              _id: {
                $cond: [{ $gt: ['$variantCount', 1] }, 'variable', 'simple'],
              },
              count: { $sum: 1 },
            },
          },
        ]),

        // Category Distribution
        this.ProductModel.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
            },
          },
          {
            $lookup: {
              from: 'categories',
              localField: '_id',
              foreignField: '_id',
              as: 'categoryInfo',
            },
          },
          {
            $unwind: {
              path: '$categoryInfo',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              categoryName: {
                $ifNull: [`$categoryInfo.name.${lang}`, 'Uncategorized'],
              },
              count: 1,
            },
          },
        ]),

        // Timeline: 30 days
        this.ProductModel.aggregate([
          {
            $match: {
              createdAt: { $gte: start30DaysAgo },
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
      ]);

      const composition = statusCounts.reduce<Record<string, number>>(
        (acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        },
        {},
      );

      const categoryDistribution = categoryDistributionRaw.map((entry) => ({
        name: entry.categoryName,
        value: entry.count,
      }));

      const last30DaysProducts = last30DaysRaw.map((entry) => ({
        date: entry._id,
        count: entry.count,
      }));

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

      const result = {
        status: 'success',
        data: {
          totalProducts,
          statusBreakdown,
          currentPeriodProducts: currentMonthProducts,
          dailyNewProducts,
          last30DaysProducts,
          composition: {
            simple: compositionRaw.find((c) => c._id === 'simple')?.count || 0,
            variable:
              compositionRaw.find((c) => c._id === 'variable')?.count || 0,
          },
          categoryDistribution,
          topProducts: topProductsRaw,
          lowStockCount,
          lowStockProducts: lowStockProductsRaw,
          inventoryStats: variantStats[0]
            ? {
                ...variantStats[0],
                stockHealth:
                  totalProducts > 0
                    ? ((totalProducts -
                        (lowStockCount > totalProducts
                          ? totalProducts
                          : lowStockCount)) /
                        totalProducts) *
                      100
                    : 0,
              }
            : {
                totalVariants: 0,
                totalStock: 0,
                totalSold: 0,
                totalValue: 0,
                avgPrice: 0,
                stockHealth: 0,
              },
          dateRange: { start, end },
          sortedBy: sortBy,
          lang,
        },
      };

      // Store in cache for 5 minutes
      await this.cacheManager.set(cacheKey, result, 300_000);

      return result;
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to fetch products statistics.',
        error,
      };
    }
  }
}
