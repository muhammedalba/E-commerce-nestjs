import { Model } from 'mongoose';
import { startOfMonth, endOfMonth, subDays, startOfDay } from 'date-fns';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Product } from '../shared/schemas/Product.schema';
import { ProductVariant } from '../shared/schemas/ProductVariant.schema';
import { OrdersStatisticsService } from 'src/order/shared/order-helper/order-statistics.service';
import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class ProductsStatistics {
  constructor(
    @InjectModel(ProductVariant.name)
    private readonly VariantModel: Model<ProductVariant>,
    private readonly ordersStatisticsService: OrdersStatisticsService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @InjectModel(Product.name) private readonly ProductModel: Model<Product>,
  ) {}
  async Products_statistics(
    startDate?: string,
    endDate?: string,
    sortBy: 'sold' | 'ratingsAverage' | 'stock' = 'sold',
  ) {
    const lang = I18nContext.current()?.lang ?? 'ar';
    const cacheKey = `products:stats:v2:${lang}:${sortBy}:${startDate}:${endDate}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // تحضير النطاق الزمني بشكل صحيح
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
        // 1. الإحصائيات العامة (نفس منطقك السابق مع تحسين)
        this.getBasicSummary(start, end),

        // 2. أفضل المنتجات مبيعاً مع فلترة التاريخ
        this.getTopProducts(start, end, lang),

        // 3. أداء العلامات التجارية (Brands)
        this.getBrandPerformance(lang),

        // 4. إحصائيات الموردين (Suppliers) والمخزون
        this.getSupplierStats(),

        // 5. توزيع الفئات
        this.getCategoryDistribution(lang),

        // 6. توزيع الفئات الفرعية
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
      // Error handling...
    }
  }

  // --- دوال Aggregation المنفصلة للتنظيم ---

  private async getTopProducts(start: Date, end: Date, lang: string) {
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

    // 2. Fetch the product details and current stock variants using Product/Variant models
    // Since topSales has the object IDs, we need to map them back correctly.
    // We can use an aggregation on VariantModel or ProductModel, but since we just need simple data,
    // we can do a lookup or parallel queries. For performance, let's just use a clean aggregation
    // filtered by the specific IDs.
    const enrichedProducts = await this.ProductModel.aggregate([
      {
        $match: {
          _id: { $in: productIds }, // Note: we assume productIds are ObjectIds already depending on schema, but they might need conversion
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
          title: 1,
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
      return {
        _id: sale.productId,
        totalSold: sale.totalSold,
        // Include UI needed fields:
        title: productDetail?.title || { en: 'Unknown', ar: 'مجهول' },
        imageCover: productDetail?.imageCover
          ? productDetail.imageCover.startsWith('http')
            ? productDetail.imageCover
            : `${process.env.BASE_URL || ''}${productDetail.imageCover}`
          : undefined,
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
      // 1. تحويل النص إلى ObjectId بأمان لتجنب الأخطاء
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
      // 2. استخدام الحقل المحول في الـ Lookup
      {
        $lookup: {
          from: 'brands', // تأكد أن هذا اسم الكولكشن الفعلي في MongoDB
          localField: 'brandObjId',
          foreignField: '_id',
          as: 'brandInfo',
        },
      },
      { $unwind: { path: '$brandInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          // 3. عرض ذكي للاسم: يبحث عن الاسم المترجم، وإن لم يجده يبحث عن النص العادي
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
      // تحويل الـ id الخاص بالمورد لـ ObjectId
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
    // جلب الإحصائيات الأساسية بالتوازي لضمان السرعة
    const [
      totalProducts,
      statusCounts,
      currentPeriodProducts,
      inventoryAndCompositionSummary, // <== الاستعلام الجديد المدمج
      lowStockCount,
    ] = await Promise.all([
      // إجمالي المنتجات الكلي في النظام
      this.ProductModel.countDocuments(),

      // تقسيم المنتجات حسب الحالة (نشط / غير نشط) للمنتجات غير المحذوفة
      this.ProductModel.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$isActive', count: { $sum: 1 } } },
      ]),

      // المنتجات المضافة خلال الفترة المحددة
      this.ProductModel.countDocuments({
        createdAt: { $gte: start, $lte: end },
      }),

      // الاستعلام المُحسّن: حساب المخزون الكلي والتكوين (بسيط/متغير) في خطوة واحدة
      this.ProductModel.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            totalStockSystemWide: { $sum: '$stockSummary' }, // جمع المخزون الكلي سريعاً
            variableCount: {
              $sum: { $cond: [{ $gt: ['$variantCount', 1] }, 1, 0] },
            },
            simpleCount: {
              $sum: { $cond: [{ $lte: ['$variantCount', 1] }, 1, 0] },
            },
          },
        },
      ]),

      // عدد المتغيرات ذات المخزون المنخفض (أقل من 15)
      // ملاحظة: يفضل تغيير الرقم 15 ليصبح متغيراً من البيئة مستقبلاً (Environment Variable)
      this.VariantModel.countDocuments({
        stock: { $lt: 15 },
        isDeleted: { $ne: true },
      }),
    ]);

    // تنسيق مخرجات الحالات
    const statusBreakdown = statusCounts.reduce<Record<string, number>>(
      (acc, curr: { _id: string; count: number }) => {
        acc[curr._id] = curr.count;
        return acc;
      },
      {},
    );

    // استخراج بيانات المخزون والتكوين بأمان (في حال كانت الداتابيز فارغة)
    const summaryStats = inventoryAndCompositionSummary[0] || {
      totalStockSystemWide: 0,
      variableCount: 0,
      simpleCount: 0,
    };

    // تنسيق مخرجات التكوين
    const composition = {
      simple: summaryStats.simpleCount,
      variable: summaryStats.variableCount,
    };

    return {
      totalProducts,
      statusBreakdown,
      currentPeriodProducts,
      totalStock: summaryStats.totalStockSystemWide, // <== إضافة إجمالي المخزون للرد
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
      // 1. استبعاد المنتجات المحذوفة
      { $match: { isDeleted: { $ne: true } } },

      // 2. تفكيك مصفوفة الفئات الفرعية
      // إذا كان الحقل في السكيما اسمه 'subCategories' مثلاً، قم بتعديله هنا
      {
        $unwind: {
          path: '$SubCategories', // تأكد من اسم الحقل في سكيما المنتج
          preserveNullAndEmptyArrays: false, // نتجاهل المنتجات التي ليس لها فئة فرعية لأننا حسبناها في الفئات الرئيسية
        },
      },

      // 3. التجميع والعد بناءً على الـ ID الخاص بالفئة الفرعية
      {
        $group: {
          _id: '$SubCategories',
          count: { $sum: 1 },
        },
      },

      // 4. تحويل الـ ID إذا لزم الأمر (كدرع حماية كما تعلمنا)
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

      // 5. الربط مع جدول الفئات الفرعية لجلب الاسم
      {
        $lookup: {
          from: 'subcategories', // تأكد أن هذا هو اسم كولكشن الفئات الفرعية الفعلي في قاعدة البيانات
          localField: 'subCatObjId',
          foreignField: '_id',
          as: 'subCategoryInfo',
        },
      },

      // 6. تفكيك المصفوفة الناتجة عن الربط
      {
        $unwind: { path: '$subCategoryInfo', preserveNullAndEmptyArrays: true },
      },

      // 7. تشكيل المخرجات النهائية مع دعم تعدد اللغات
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

      // 8. الترتيب التنازلي لإظهار الفئات الفرعية الأكثر امتلاءً بالمنتجات أولاً
      { $sort: { value: -1 } },

      // يمكنك إضافة $limit: 10 إذا كان لديك مئات الفئات الفرعية ولا تريد إثقال الواجهة
      { $limit: 10 },
    ]);
  }
}
