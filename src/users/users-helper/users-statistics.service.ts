import { Model } from 'mongoose';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'src/auth/shared/schema/user.schema';

@Injectable()
export class UsersStatistics {
  constructor(
    @InjectModel(User.name) private readonly UserModel: Model<User>,
  ) {}

  async users_statistics(startDate?: string, endDate?: string) {
    try {
      const today = new Date();

      // 1. التواريخ الديناميكية
      const start = startDate ? new Date(startDate) : startOfMonth(today);
      const end = endDate ? new Date(endDate) : endOfMonth(today);

      const [
        totalUsersRaw,
        statusCounts,
        roleCounts,
        periodNewCustomers,
        dailyRegistrationsRaw, // <== إحصائية جديدة (منحنى النمو)
      ] = await Promise.all([
        // إجمالي المستخدمين (باستثناء المحذوفين إن وجد)
        this.UserModel.countDocuments({ isDeleted: { $ne: true } }),

        // توزيع الحالات (نشط / غير نشط)
        this.UserModel.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          { $group: { _id: '$isActive', count: { $sum: 1 } } },
        ]),

        // توزيع الأدوار (Admin, User, Manager...)
        this.UserModel.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          { $group: { _id: '$role', count: { $sum: 1 } } },
        ]),

        // العملاء الجدد فقط (نستثني الإداريين) خلال الفترة المحددة
        this.UserModel.countDocuments({
          createdAt: { $gte: start, $lte: end },
          role: 'user', // تأكد من اسم الـ Role الخاص بالعملاء في نظامك
          isDeleted: { $ne: true },
        }),

        // الخط الزمني للتسجيلات اليومية للعملاء الجدد (لرسم Chart)
        this.UserModel.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              role: 'user', // التركيز على العملاء الجدد فقط
              isDeleted: { $ne: true },
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

      // تنسيق مخرجات الحالات
      const statusBreakdown = statusCounts.reduce<Record<string, number>>(
        (acc, curr) => {
          // التعامل مع القيم المنطقية (true/false) وتحويلها لنصوص لتسهيل قراءتها
          const statusKey =
            curr._id === true
              ? 'active'
              : curr._id === false
                ? 'inactive'
                : String(curr._id);
          acc[statusKey] = curr.count;
          return acc;
        },
        {},
      );

      // تنسيق مخرجات الأدوار
      const roleBreakdown = roleCounts.reduce<Record<string, number>>(
        (acc, curr) => {
          acc[curr._id || 'unknown'] = curr.count;
          return acc;
        },
        {},
      );

      // تنسيق النمو اليومي
      const dailyRegistrations = dailyRegistrationsRaw.map((entry) => ({
        date: entry._id,
        count: entry.count,
      }));

      return {
        status: 'success',
        data: {
          overview: {
            totalUsers: totalUsersRaw,
            periodNewCustomers, // مؤشر أداء رئيسي (KPI) للتسويق
          },
          statusBreakdown,
          roleBreakdown,
          dailyRegistrations, // مصفوفة جاهزة لرسم المنحنى البياني

          dateRange: { start, end },
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to fetch users statistics.',
        error: error instanceof Error ? error.message : error,
      };
    }
  }
}
