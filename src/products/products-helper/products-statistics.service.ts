import { Model, Types } from 'mongoose';
import { startOfMonth, endOfMonth } from 'date-fns';
import {
  Inject,
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Product } from '../shared/schemas/Product.schema';
import { ProductVariant } from '../shared/schemas/ProductVariant.schema';
import { OrdersStatisticsService } from 'src/order/shared/order-helper/order-statistics.service';
import { I18nContext } from 'nestjs-i18n';
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import { withBaseUrl } from 'src/shared/utils/with-base-url.util';

interface EnrichedProductDetail {
  _id: Types.ObjectId | string;
  title?: { en?: string; ar?: string };
  imageCover?: string | FileAsset;
  priceRange?: { min: number; max: number };
  stockSummary?: number;
  ratingsAverage?: number;
  ratingsQuantity?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  isUnlimitedStock?: boolean;
  variantCount?: number;
  brandId?: Types.ObjectId | string | null;
  stockValue?: number;
}

interface InventoryCompositionSummary {
  _id?: null;
  totalStockSystemWide: number;
  variableCount: number;
  simpleCount: number;
}
@Injectable()
export class ProductsStatistics {
  private readonly logger = new Logger(ProductsStatistics.name);

  constructor(
    @InjectModel(ProductVariant.name)
    private readonly VariantModel: Model<ProductVariant>,
    private readonly ordersStatisticsService: OrdersStatisticsService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @InjectModel(Product.name)
    private readonly ProductModel: Model<Product>,
  ) {}
  async Products_statistics(
    startDate?: string,
    endDate?: string,
    sortBy: 'sold' | 'ratingsAverage' | 'stock' = 'sold',
  ) {
    const lang: 'ar' | 'en' =
      I18nContext.current()?.lang === 'en' ? 'en' : 'ar';
    const cacheKey = `products:stats:v2:${lang}:${sortBy}:${startDate}:${endDate}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // Properly preparing the timeframe
    const today = new Date();
    const start = startDate ? new Date(startDate) : startOfMonth(today);
    const end = endDate ? new Date(endDate) : endOfMonth(today);

    try {
      const [
        basicStats,
        topProducts,
        brandPerformance,
        supplierStats,
        categoryStats,
        subcategoryStats,
      ] = await Promise.all([
        // 1. General statistics (Same previous logic with improvement)
        this.getBasicSummary(start, end),

        // 2. Best-selling products with date filtering
        this.getTopProducts(start, end, lang),

        // 3. Brand performance
        this.getBrandPerformance(lang),

        // 4. Supplier stats and stock
        this.getSupplierStats(),

        // 5. Category distribution
        this.getCategoryDistribution(lang),

        // 6. Subcategory distribution
        this.getSubcategoryDistribution(lang),
      ]);

      const result = {
        status: 'success',
        data: {
          summary: basicStats,
          topProducts,
          brandPerformance,
          supplierStats,
          categoryStats,
          subcategoryStats,
          dateRange: { start, end },
        },
      };

      await this.cacheManager.set(cacheKey, result, 300_000);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to calculate products statistics: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        lang === 'ar'
          ? 'حدث خطأ أثناء جلب إحصائيات المنتجات'
          : 'Failed to retrieve products statistics',
      );
    }
  }

  // --- Separate aggregation functions for grouping ---

  private async getTopProducts(start: Date, end: Date, lang: 'ar' | 'en') {
    // 1. Get Top Selling IDs and Quantities from Orders module (Clean Architecture approach)
    const topSales = await this.ordersStatisticsService.getTopSellingProductIds(
      start,
      end,
      5,
    );

    if (!topSales || topSales.length === 0) {
      return [];
    }

    const productIds = topSales.map((item) => item.productId);
    const productObjectIds = productIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    // 2. Fetch the product details and current stock variants using Product/Variant models
    // Since topSales has the object IDs, we need to map them back correctly.
    // We can use an aggregation on VariantModel or ProductModel, but since we just need simple data,
    // we can do a lookup or parallel queries. For performance, let's just use a clean aggregation
    // filtered by the specific IDs.
    const enrichedProducts =
      await this.ProductModel.aggregate<EnrichedProductDetail>([
        {
          $match: {
            _id: {
              $in: productObjectIds.length ? productObjectIds : productIds,
            },
          },
        },
        {
          $lookup: {
            from: 'productvariants',
            localField: '_id',
            foreignField: 'productId',
            as: 'variants',
          },
        },
        {
          $project: {
            _id: 1,
            title: {
              $ifNull: [`$title.${lang}`, { $ifNull: ['$title', 'Unknown'] }],
            },
            imageCover: 1,
            priceRange: 1,
            stockSummary: 1,
            ratingsAverage: 1,
            ratingsQuantity: 1,
            isActive: 1,
            isFeatured: 1,
            isUnlimitedStock: 1,
            variantCount: 1,
            brandId: '$brand',
            stockValue: {
              $reduce: {
                input: '$variants',
                initialValue: 0,
                in: {
                  $add: [
                    '$$value',
                    {
                      $multiply: [
                        { $ifNull: ['$$this.price', 0] },
                        { $ifNull: ['$$this.stock', 0] },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      ]);

    // 3. Merge in-memory to preserve the exact sort order of topSales
    return topSales.map((sale) => {
      const productDetail = enrichedProducts.find(
        (p) => String(p._id) === String(sale.productId),
      );
      const resolvedCover = withBaseUrl(productDetail?.imageCover);
      const imageCover =
        typeof resolvedCover === 'object' && resolvedCover !== null
          ? resolvedCover.url
          : resolvedCover;

      return {
        _id: sale.productId,
        totalSold: sale.totalSold,
        // Include UI needed fields:
        title: productDetail?.title || 'Unknown',
        imageCover,
        priceRange: productDetail?.priceRange,
        stockSummary: productDetail?.stockSummary,
        ratingsAverage: productDetail?.ratingsAverage,
        ratingsQuantity: productDetail?.ratingsQuantity,
        isActive: productDetail?.isActive,
        isFeatured: productDetail?.isFeatured,
        isUnlimitedStock: productDetail?.isUnlimitedStock,
        variantCount: productDetail?.variantCount,
        // Backend specific stats:
        stockValue: productDetail?.stockValue || 0,
        brandId: productDetail?.brandId || null,
      };
    });
  }

  private async getBrandPerformance(lang: string) {
    return this.ProductModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$brand',
          productCount: { $sum: 1 },
        },
      },
      // 1. Safely convert text to ObjectId to avoid errors.
      {
        $addFields: {
          brandObjId: {
            $convert: {
              input: '$_id',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      // 2. Using the transformed field in the lookup
      {
        $lookup: {
          from: 'brands', // Make sure this is the actual collection name in MongoDB
          localField: 'brandObjId',
          foreignField: '_id',
          as: 'brandInfo',
        },
      },
      { $unwind: { path: '$brandInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          // 3. Intelligent display of the name: looks for the translated name, and if not found, looks for the normal text
          brandName: {
            $ifNull: [
              `$brandInfo.name.${lang}`,
              { $ifNull: ['$brandInfo.name', 'Unknown'] },
            ],
          },
          productCount: 1,
        },
      },
      { $sort: { productCount: -1 } },
    ]);
  }

  private async getSupplierStats() {
    return this.VariantModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
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
        $group: {
          _id: '$product.supplier',
          totalItems: { $sum: '$stock' },
          investmentValue: { $sum: { $multiply: ['$price', '$stock'] } },
        },
      },
      // Convert the supplier's ID to an ObjectId.
      {
        $addFields: {
          supplierObjId: {
            $convert: {
              input: '$_id',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplierObjId',
          foreignField: '_id',
          as: 'supplierInfo',
        },
      },
      { $unwind: { path: '$supplierInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          supplierId: '$_id',
          supplierName: { $ifNull: ['$supplierInfo.name', 'Direct Sourcing'] },
          totalItems: 1,
          investmentValue: 1,
        },
      },
      { $sort: { investmentValue: -1 } },
    ]);
  }

  private async getBasicSummary(start: Date, end: Date) {
    // Fetch key statistics in parallel to ensure speed.
    const [
      totalProducts,
      statusCounts,
      currentPeriodProducts,
      inventoryAndCompositionSummary, // <== The new combined query
      lowStockCount,
    ] = await Promise.all([
      // Total products in the system
      this.ProductModel.countDocuments(),

      // Products grouped by status (active / inactive) for non-deleted products
      this.ProductModel.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$isActive', count: { $sum: 1 } } },
      ]),

      // Products added during the specified period
      this.ProductModel.countDocuments({
        createdAt: { $gte: start, $lte: end },
      }),

      // Optimized query: Calculate total stock and composition (simple/variable) in one step
      this.ProductModel.aggregate<InventoryCompositionSummary>([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            totalStockSystemWide: { $sum: '$stockSummary' }, // Quickly aggregate total inventory.
            variableCount: {
              $sum: { $cond: [{ $gt: ['$variantCount', 1] }, 1, 0] },
            },
            simpleCount: {
              $sum: { $cond: [{ $lte: ['$variantCount', 1] }, 1, 0] },
            },
          },
        },
      ]),

      // Number of variants with low stock (less than 15)
      // Note: The number 15 is preferred to be changed to an environment variable in the future (Environment Variable)
      this.VariantModel.countDocuments({
        stock: { $lt: 15 },
        isDeleted: { $ne: true },
      }),
    ]);

    // Format status output
    const statusBreakdown = statusCounts.reduce<Record<string, number>>(
      (acc, curr: { _id: string; count: number }) => {
        acc[curr._id] = curr.count;
        return acc;
      },
      {},
    );

    // Extract inventory and composition data safely (in case the database is empty)
    const summaryStats = inventoryAndCompositionSummary[0] || {
      totalStockSystemWide: 0,
      variableCount: 0,
      simpleCount: 0,
    };

    // Formatting the composition output
    const composition = {
      simple: summaryStats.simpleCount,
      variable: summaryStats.variableCount,
    };

    return {
      totalProducts,
      statusBreakdown,
      currentPeriodProducts,
      totalStock: summaryStats.totalStockSystemWide, // <== Add total inventory to the response.
      composition,
      lowStockCount,
    };
  }
  private async getCategoryDistribution(lang: string) {
    return this.ProductModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      {
        $addFields: {
          catObjId: {
            $convert: {
              input: '$_id',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'catObjId',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          name: {
            $ifNull: [
              `$categoryInfo.name.${lang}`,
              { $ifNull: ['$categoryInfo.name', 'Uncategorized'] },
            ],
          },
          value: '$count',
        },
      },
      { $sort: { value: -1 } },
    ]);
  }
  private async getSubcategoryDistribution(lang: string) {
    return this.ProductModel.aggregate([
      // 1. Exclude deleted products
      { $match: { isDeleted: { $ne: true } } },

      // 2. Deconstructing the matrix of subcategories
      {
        $unwind: {
          path: '$SubCategories',
          preserveNullAndEmptyArrays: false, // We ignore products that do not have a subcategory because we have already accounted for them in the main categories.
        },
      },

      // 3.Grouping and counting based on the sub-category ID.
      {
        $group: {
          _id: '$SubCategories',
          count: { $sum: 1 },
        },
      },

      // 4.Converting the ID if necessary (as a protective shield).
      {
        $addFields: {
          subCatObjId: {
            $convert: {
              input: '$_id',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },

      // 5. Associating with the sub-category table to get the name
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subCatObjId',
          foreignField: '_id',
          as: 'subCategoryInfo',
        },
      },

      // 6.Decomposing the matrix resulting from the concatenation
      {
        $unwind: { path: '$subCategoryInfo', preserveNullAndEmptyArrays: true },
      },

      // 7.Formatting final outputs with multilingual support.
      {
        $project: {
          _id: 0,
          subCategoryId: '$_id',
          name: {
            $ifNull: [
              `$subCategoryInfo.name.${lang}`,
              { $ifNull: ['$subCategoryInfo.name.en', 'Unknown Subcategory'] },
            ],
          },
          value: '$count',
        },
      },

      // 8. descending order to show the most populous sub-categories first
      { $sort: { value: -1 } },

      // You can add $limit: 10 if you have hundreds of sub-categories and don't want to overload the interface.
      { $limit: 10 },
    ]);
  }
}
