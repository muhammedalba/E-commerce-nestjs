import { Model } from 'mongoose';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Order } from '../schemas/Order.schema';
import { I18nContext } from 'nestjs-i18n'; // لجلب لغة الاستعلام إن وجدت
import { OrderStatus } from '../enums/order-status.enum';

export interface TopSellingProductStat {
  productId: string;
  totalSold: number;
}

export interface StatusCountStat {
  _id: string;
  count: number;
}

export interface FinancialMetrics {
  totalRevenue: number;
  validOrdersCount: number;
  averageOrderValue: number;
}

export interface DailyOrderStat {
  _id: string;
  count: number;
  dailyRevenue: number;
}

export interface TopProductStat {
  productId: string;
  totalQuantity: number;
  productName: string;
}

export interface TopCustomerStat {
  userId: string;
  totalOrders: number;
  totalSpent: number;
  userName: string;
}

@Injectable()
export class OrdersStatisticsService {
  constructor(
    @InjectModel(Order.name) private readonly OrderModel: Model<Order>,
  ) {}

  // A helper function to fetch best-selling products for use by other modules (Clean Architecture).
  async getTopSellingProductIds(
    start: Date,
    end: Date,
    limit: number = 5,
  ): Promise<{ productId: string; totalSold: number }[]> {
    const excludedStatuses = [OrderStatus.CANCELLED, OrderStatus.EXPIRED];
    return this.OrderModel.aggregate<TopSellingProductStat>([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $nin: excludedStatuses },
          isDeleted: { $ne: true },
        },
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
          totalSold: 1,
        },
      },
    ]);
  }

  async OrdersStatistics(startDate?: string, endDate?: string) {
    try {
      const lang =
        I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
      const today = new Date();

      const start = startDate ? new Date(startDate) : startOfMonth(today);
      const end = endDate ? new Date(endDate) : endOfMonth(today);

      //Cases excluded from actual profits and sales
      const excludedStatuses = [OrderStatus.CANCELLED, OrderStatus.EXPIRED];

      const [
        totalOrders,
        statusCounts,
        currentPeriodOrders,
        financialMetricsRaw,
        dailyOrdersRaw,
        topProductsRaw,
        topCustomersRaw,
      ] = await Promise.all([
        // 1. Total cumulative orders (historical)
        this.OrderModel.countDocuments(),

        // 2. Distribution of cases during the specified period
        this.OrderModel.aggregate<StatusCountStat>([
          { $match: { createdAt: { $gte: start, $lte: end } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        // 3. Number of requests for the current period
        this.OrderModel.countDocuments({
          createdAt: { $gte: start, $lte: end },
        }),

        // 4. Financial revenue (for successful orders only)
        this.OrderModel.aggregate<FinancialMetrics>([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              status: { $nin: excludedStatuses },
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$totalPrice' },
              validOrdersCount: { $sum: 1 },
              averageOrderValue: { $avg: '$totalPrice' },
            },
          },
        ]),

        // 5. Daily sales during the period
        this.OrderModel.aggregate<DailyOrderStat>([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              status: { $nin: excludedStatuses }, //Optional: If you want to plot only successful requests.
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              count: { $sum: 1 },
              dailyRevenue: { $sum: '$totalPrice' },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // 6.Best-selling products (successful orders)
        this.OrderModel.aggregate<TopProductStat>([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              status: { $nin: excludedStatuses },
            },
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
              from: 'products',
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
              productName: {
                $ifNull: [
                  `$product.title.${lang}`,
                  { $ifNull: ['$product.title.en', 'Unknown Product'] },
                ],
              },
            },
          },
        ]),

        // 7. أفضل العملاء (بناءً على حجم الإنفاق وليس عدد الطلبات)
        this.OrderModel.aggregate<TopCustomerStat>([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              status: { $nin: excludedStatuses },
            },
          },
          {
            $group: {
              _id: '$user',
              totalOrders: { $sum: 1 },
              totalSpent: { $sum: '$totalPrice' }, // حجم الإنفاق
            },
          },
          { $sort: { totalSpent: -1 } }, // الترتيب بالإنفاق
          { $limit: 5 },
          {
            $addFields: {
              userIdObj: {
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
        (acc, curr) => {
          acc[curr._id || 'unknown'] = curr.count;
          return acc;
        },
        {},
      );

      // استخراج الإحصائيات المالية
      const financials: FinancialMetrics = financialMetricsRaw[0] || {
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
            averageOrderValue:
              Math.round(financials.averageOrderValue * 100) / 100,
          },
          statusBreakdown,
          dailyOrders,
          topProducts: topProductsRaw,
          topCustomers: topCustomersRaw,
          dateRange: { start, end },
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
