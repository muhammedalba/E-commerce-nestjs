import { Model } from 'mongoose';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Order } from '../schemas/Order.schema'; // تأكد من المسار
import { Coupon } from 'src/coupons/shared/Schemas/coupons.schema';

@Injectable()
export class MarketingStatisticsService {
  constructor(
    @InjectModel(Order.name) private readonly OrderModel: Model<Order>,
    @InjectModel(Coupon.name) private readonly CouponModel: Model<Coupon>,
  ) {}

  async getMarketingStatistics(startDate?: string, endDate?: string) {
    try {
      const today = new Date();
      const start = startDate ? new Date(startDate) : startOfMonth(today);
      const end = endDate ? new Date(endDate) : endOfMonth(today);
      
      // استبعاد الطلبات الملغاة لتجنب حساب مبيعات أو خصومات وهمية
      // لاحظ استخدام 'cancelled' المطابقة للسكيما الخاصة بك
      const excludedStatuses = ['cancelled', 'failed'];

      const [
        couponsOverviewRaw,
        salesBreakdownRaw,
        topPerformingCouponsRaw
      ] = await Promise.all([
        // 1. نظرة عامة على حالة الكوبونات في النظام
        this.CouponModel.aggregate([
          {
            $group: {
              _id: null,
              totalCoupons: { $sum: 1 },
              activeCoupons: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ['$active', true] }, { $gt: ['$expires', today] }] },
                    1,
                    0
                  ]
                }
              },
              expiredCoupons: {
                $sum: { $cond: [{ $lt: ['$expires', today] }, 1, 0] }
              }
            }
          }
        ]),

        // 2. تحليل المبيعات: العضوية (بدون كوبون) مقابل التسويقية (بكوبون)
        this.OrderModel.aggregate([
          { 
            $match: { 
              createdAt: { $gte: start, $lte: end },
              status: { $nin: excludedStatuses },
              isDeleted: { $ne: true }
            } 
          },
          {
            $group: {
              _id: { 
                $cond: [
                  { $and: [{ $ne: ['$couponCode', null] }, { $ne: ['$couponCode', ''] }] }, 
                  'with_coupon', 
                  'organic'
                ] 
              },
              ordersCount: { $sum: 1 },
              // الإيراد الحقيقي: نأخذ السعر بعد الخصم إن وجد، وإلا نأخذ السعر الأساسي
              totalRevenue: { $sum: { $ifNull: ['$totalPriceAfterDiscount', '$totalPrice'] } },
              // إجمالي الأموال المخصومة
              totalDiscountGiven: { $sum: { $ifNull: ['$discountAmount', 0] } }
            }
          }
        ]),

        // 3. أفضل الكوبونات أداءً وجلباً للإيرادات
        this.OrderModel.aggregate([
          { 
            $match: { 
              createdAt: { $gte: start, $lte: end },
              status: { $nin: excludedStatuses },
              isDeleted: { $ne: true },
              couponCode: { $type: 'string', $ne: '' } // الطلبات التي تحتوي على كود كوبون فعلي
            } 
          },
          {
            $group: {
              _id: '$couponCode',
              usageCount: { $sum: 1 },
              revenueGenerated: { $sum: { $ifNull: ['$totalPriceAfterDiscount', '$totalPrice'] } },
              totalDiscounted: { $sum: '$discountAmount' }
            }
          },
          { $sort: { revenueGenerated: -1 } }, // الترتيب حسب أكثر كوبون جلب إيرادات
          { $limit: 5 },
          // جلب تفاصيل الكوبون الأصلي من جدول الكوبونات (مثل النوع وقيمة الخصم الأساسية)
          {
            $lookup: {
              from: 'coupons', // تأكد من اسم كولكشن الكوبونات (بالجمع وأحرف صغيرة)
              localField: '_id',
              foreignField: 'name',
              as: 'couponDetails'
            }
          },
          { $unwind: { path: '$couponDetails', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              couponCode: '$_id',
              usageCount: 1,
              revenueGenerated: 1,
              totalDiscounted: 1,
              couponType: { $ifNull: ['$couponDetails.type', 'unknown'] },
              baseDiscount: { $ifNull: ['$couponDetails.discount', 0] }
            }
          }
        ])
      ]);

      // تنسيق مخرجات الكوبونات
      const couponsOverview = couponsOverviewRaw[0] || {
        totalCoupons: 0,
        activeCoupons: 0,
        expiredCoupons: 0
      };

      // تنسيق مخرجات المبيعات والتسويق
      const salesBreakdown = salesBreakdownRaw.reduce<Record<string, any>>(
        (acc, curr) => {
          acc[curr._id] = {
            orders: curr.ordersCount,
            revenue: curr.totalRevenue,
            discount: curr.totalDiscountGiven
          };
          return acc;
        },
        { 
          organic: { orders: 0, revenue: 0, discount: 0 }, 
          with_coupon: { orders: 0, revenue: 0, discount: 0 } 
        }
      );

      // إجمالي الخصومات التي تحملها المتجر خلال الفترة
      const totalMarketingCost = salesBreakdown['with_coupon']?.discount || 0;

      return {
        status: 'success',
        data: {
          period: { start, end },
          overview: {
            ...couponsOverview,
            totalMarketingCost // رقم بالغ الأهمية للمدير المالي
          },
          salesBreakdown: {
            organic: salesBreakdown['organic'],
            marketing: salesBreakdown['with_coupon']
          },
          topPerformingCoupons: topPerformingCouponsRaw
        }
      };

    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to fetch marketing statistics.',
        error: error instanceof Error ? error.message : error,
      };
    }
  }
}