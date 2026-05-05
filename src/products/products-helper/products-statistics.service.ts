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
    @InjectModel(ProductVariant.name) private readonly VariantModel: Model<ProductVariant>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @InjectModel(Product.name) private readonly ProductModel: Model<Product>,
  ) { }
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
          dateRange: { start, end }
        }
      };

      await this.cacheManager.set(cacheKey, result, 300_000);
      return result;
    } catch (error) {
      // Error handling...
    }
  }

  // --- دوال Aggregation المنفصلة للتنظيم ---

  private async getTopProducts(start: Date, end: Date, lang: string) {
    return this.VariantModel.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          // ملاحظة: هنا نفترض وجود تاريخ لكل عملية بيع أو تحديث
          // إذا كان لديك جدول Orders سيكون أدق، ولكن هنا نستخدم createdAt للـ variant
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$productId',
          totalSold: { $sum: '$sold' },
          stockValue: { $sum: { $multiply: ['$price', '$stock'] } },
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: `$product.title.${lang}`,
          totalSold: 1,
          stockValue: 1,
          brandId: '$product.brand' // سنحتاجه للربط
        }
      }
    ]);
  }

  private async getBrandPerformance(lang: string) {
    return this.ProductModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$brand',
          productCount: { $sum: 1 },
        }
      },
      // 1. تحويل النص إلى ObjectId بأمان لتجنب الأخطاء
      {
        $addFields: {
          brandObjId: {
            $convert: { input: '$_id', to: 'objectId', onError: null, onNull: null }
          }
        }
      },
      // 2. استخدام الحقل المحول في الـ Lookup
      {
        $lookup: {
          from: 'brands', // تأكد أن هذا اسم الكولكشن الفعلي في MongoDB
          localField: 'brandObjId',
          foreignField: '_id',
          as: 'brandInfo'
        }
      },
      { $unwind: { path: '$brandInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          // 3. عرض ذكي للاسم: يبحث عن الاسم المترجم، وإن لم يجده يبحث عن النص العادي
          brandName: {
            $ifNull: [
              `$brandInfo.name.${lang}`,
              { $ifNull: ['$brandInfo.name', 'Unknown'] }
            ]
          },
          productCount: 1,
        }
      },
      { $sort: { productCount: -1 } }
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
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.supplier',
          totalItems: { $sum: '$stock' },
          investmentValue: { $sum: { $multiply: ['$price', '$stock'] } }
        }
      },
      // تحويل الـ id الخاص بالمورد لـ ObjectId
      {
        $addFields: {
          supplierObjId: {
            $convert: { input: '$_id', to: 'objectId', onError: null, onNull: null }
          }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplierObjId',
          foreignField: '_id',
          as: 'supplierInfo'
        }
      },
      { $unwind: { path: '$supplierInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          supplierId: '$_id',
          supplierName: { $ifNull: ['$supplierInfo.name', 'Direct Sourcing'] },
          totalItems: 1,
          investmentValue: 1
        }
      },
      { $sort: { investmentValue: -1 } }
    ]);
  }

  private async getBasicSummary(start: Date, end: Date) {
    // جلب الإحصائيات الأساسية بالتوازي لضمان السرعة
    const [
      totalProducts,
      statusCounts,
      currentPeriodProducts,
      inventoryAndCompositionSummary, // <== الاستعلام الجديد المدمج
      lowStockCount
    ] = await Promise.all([
      // إجمالي المنتجات الكلي في النظام
      this.ProductModel.countDocuments(),

      // تقسيم المنتجات حسب الحالة (نشط / غير نشط) للمنتجات غير المحذوفة
      this.ProductModel.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$isActive', count: { $sum: 1 } } }
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
              $sum: { $cond: [{ $gt: ['$variantCount', 1] }, 1, 0] }
            },
            simpleCount: {
              $sum: { $cond: [{ $lte: ['$variantCount', 1] }, 1, 0] }
            }
          }
        }
      ]),

      // عدد المتغيرات ذات المخزون المنخفض (أقل من 15)
      // ملاحظة: يفضل تغيير الرقم 15 ليصبح متغيراً من البيئة مستقبلاً (Environment Variable)
      this.VariantModel.countDocuments({
        stock: { $lt: 15 },
        isDeleted: { $ne: true },
      })
    ]);

    // تنسيق مخرجات الحالات
    const statusBreakdown = statusCounts.reduce<Record<string, number>>(
      (acc, curr: { _id: string; count: number }) => {
        acc[curr._id] = curr.count;
        return acc;
      },
      {}
    );

    // استخراج بيانات المخزون والتكوين بأمان (في حال كانت الداتابيز فارغة)
    const summaryStats = inventoryAndCompositionSummary[0] || {
      totalStockSystemWide: 0,
      variableCount: 0,
      simpleCount: 0
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
      lowStockCount
    };
  }
  private async getCategoryDistribution(lang: string) {
    return this.ProductModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      {
        $addFields: {
          catObjId: {
            $convert: { input: '$_id', to: 'objectId', onError: null, onNull: null }
          }
        }
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
              { $ifNull: ['$categoryInfo.name', 'Uncategorized'] }
            ]
          },
          value: '$count',
        },
      },
      { $sort: { value: -1 } }
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
          preserveNullAndEmptyArrays: false // نتجاهل المنتجات التي ليس لها فئة فرعية لأننا حسبناها في الفئات الرئيسية
        }
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
            $convert: { input: '$_id', to: 'objectId', onError: null, onNull: null }
          }
        }
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
      { $unwind: { path: '$subCategoryInfo', preserveNullAndEmptyArrays: true } },

      // 7. تشكيل المخرجات النهائية مع دعم تعدد اللغات
      {
        $project: {
          _id: 0,
          subCategoryId: '$_id',
          name: {
            $ifNull: [
              `$subCategoryInfo.name.${lang}`,
              { $ifNull: ['$subCategoryInfo.name.en', 'Unknown Subcategory'] }
            ]
          },
          value: '$count',
        },
      },

      // 8. الترتيب التنازلي لإظهار الفئات الفرعية الأكثر امتلاءً بالمنتجات أولاً
      { $sort: { value: -1 } },

      // يمكنك إضافة $limit: 10 إذا كان لديك مئات الفئات الفرعية ولا تريد إثقال الواجهة
      { $limit: 10 }
    ]);
  }
}