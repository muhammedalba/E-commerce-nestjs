import { Model } from 'mongoose';
import { startOfMonth, endOfMonth, subDays, startOfDay } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Order } from '../schemas/Order.schema';
import { I18nContext } from 'nestjs-i18n'; // لجلب لغة الاستعلام إن وجدت

@Injectable()
export class OrdersStatisticsService {
  constructor(
    @InjectModel(Order.name) private readonly OrderModel: Model<Order>,
  ) {}

  // دالة مساعدة لجلب أفضل المنتجات مبيعاً لتستخدمها موديولات أخرى (Clean Architecture)
  async getTopSellingProductIds(start: Date, end: Date, limit: number = 5): Promise<{ productId: string, totalSold: number }[]> {
    const excludedStatuses = ['canceled', 'returned', 'failed', 'refunded'];
    return this.OrderModel.aggregate([
      { 
        $match: { 
          createdAt: { $gte: start, $lte: end },
          status: { $nin: excludedStatuses },
          isDeleted: { $ne: true }
        } 
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          totalSold: 1
        }
      }
    ]);
  }

  async OrdersStatistics(startDate?: string, endDate?: string) {
    try {
      const lang = I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
      const today = new Date();
      
      // تواريخ ديناميكية
      const start = startDate ? new Date(startDate) : startOfMonth(today);
      const end = endDate ? new Date(endDate) : endOfMonth(today);
      
      // الحالات المستبعدة من الأرباح والمبيعات الحقيقية
      const excludedStatuses = ['canceled', 'returned', 'failed', 'refunded'];

      const [
        totalOrders,
        statusCounts,
        currentPeriodOrders,
        financialMetricsRaw,
        dailyOrdersRaw,
        topProductsRaw,
        topCustomersRaw,
      ] = await Promise.all([
        // 1. إجمالي الطلبات الكلي (تاريخياً)
        this.OrderModel.countDocuments(),

        // 2. توزيع الحالات خلال الفترة المحددة
        this.OrderModel.aggregate([
          { $match: { createdAt: { $gte: start, $lte: end } } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),

        // 3. عدد طلبات الفترة الحالية
        this.OrderModel.countDocuments({
          createdAt: { $gte: start, $lte: end },
        }),

        // 4. الإيرادات المالية (للطلبات الناجحة فقط)
        this.OrderModel.aggregate([
          { 
            $match: { 
              createdAt: { $gte: start, $lte: end },
              status: { $nin: excludedStatuses } 
            } 
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$totalPrice' }, // تأكد من اسم حقل السعر في Order
              validOrdersCount: { $sum: 1 },
              averageOrderValue: { $avg: '$totalPrice' }
            }
          }
        ]),

        // 5. المبيعات اليومية خلال الفترة
        this.OrderModel.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              status: { $nin: excludedStatuses } // اختياري: إذا أردت رسم الطلبات الناجحة فقط
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
              dailyRevenue: { $sum: '$totalPrice' }
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // 6. أفضل المنتجات مبيعاً (الطلبات الناجحة)
        this.OrderModel.aggregate([
          { 
            $match: { 
              createdAt: { $gte: start, $lte: end },
              status: { $nin: excludedStatuses } 
            } 
          },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.productId',
              totalQuantity: { $sum: '$items.quantity' },
            },
          },
          { $sort: { totalQuantity: -1 } },
          { $limit: 5 },
          {
            $addFields: {
              productIdObj: { 
                $convert: { input: '$_id', to: 'objectId', onError: null, onNull: null } 
              },
            },
          },
          {
            $lookup: {
              from: 'products', // اسم الكولكشن الخاص بالمنتجات
              localField: 'productIdObj',
              foreignField: '_id',
              as: 'product',
            },
          },
          { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              productId: '$_id',
              totalQuantity: 1,
              // جلب الاسم باللغة المطلوبة مع الفولباك
              productName: { 
                $ifNull: [`$product.title.${lang}`, { $ifNull: ['$product.title.en', 'Unknown Product'] }] 
              },
            },
          },
        ]),

        // 7. أفضل العملاء (بناءً على حجم الإنفاق وليس عدد الطلبات)
        this.OrderModel.aggregate([
          { 
            $match: { 
              createdAt: { $gte: start, $lte: end },
              status: { $nin: excludedStatuses } 
            } 
          },
          {
            $group: {
              _id: '$user',
              totalOrders: { $sum: 1 },
              totalSpent: { $sum: '$totalPrice' } // حجم الإنفاق
            },
          },
          { $sort: { totalSpent: -1 } }, // الترتيب بالإنفاق
          { $limit: 5 },
          {
            $addFields: {
              userIdObj: { 
                $convert: { input: '$_id', to: 'objectId', onError: null, onNull: null } 
              },
            },
          },
          {
            $lookup: {
              from: 'users', // اسم الكولكشن الخاص بالمستخدمين
              localField: 'userIdObj',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              userId: '$_id',
              totalOrders: 1,
              totalSpent: 1,
              userName: { $ifNull: ['$user.name', 'Guest User'] },
            },
          },
        ]),
      ]);

      // تنسيق مخرجات الحالات
      const statusBreakdown = statusCounts.reduce<Record<string, number>>(
        (acc, curr: { _id: string; count: number }) => {
          acc[curr._id || 'unknown'] = curr.count;
          return acc;
        },
        {},
      );

      // استخراج الإحصائيات المالية
      const financials = financialMetricsRaw[0] || {
        totalRevenue: 0,
        validOrdersCount: 0,
        averageOrderValue: 0,
      };

      // تنسيق المبيعات اليومية
      const dailyOrders = dailyOrdersRaw.map((entry) => ({
        date: entry._id,
        count: entry.count,
        revenue: entry.dailyRevenue || 0,
      }));

      return {
        status: 'success',
        data: {
          overview: {
            totalOrdersSystemWide: totalOrders,
            currentPeriodOrders: currentPeriodOrders,
            validOrdersCount: financials.validOrdersCount,
            totalRevenue: financials.totalRevenue,
            averageOrderValue: Math.round(financials.averageOrderValue * 100) / 100,
          },
          statusBreakdown,
          dailyOrders,
          topProducts: topProductsRaw,
          topCustomers: topCustomersRaw,
          dateRange: { start, end }
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to fetch orders statistics.',
        error: error instanceof Error ? error.message : error,
      };
    }
  }
}