import { Model } from 'mongoose';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'src/auth/shared/schema/user.schema';
import { Role } from 'src/roles/shared/schemas/role.schema';

@Injectable()
export class UsersStatistics {
  constructor(
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
  ) {}

  async users_statistics(startDate?: string, endDate?: string) {
    try {
      const today = new Date();

      // 1. التواريخ الديناميكية
      const start = startDate ? new Date(startDate) : startOfMonth(today);
      const end = endDate ? new Date(endDate) : endOfMonth(today);

      // البحث عن كائن الدور الخاص بالعملاء (User) للحصول على الـ ObjectId الخاص به
      const userRole = await this.roleModel
        .findOne({ name: { $regex: /^user$/i } })
        .lean();
      const userRoleId = userRole ? userRole._id : null;
      const userRoleIds = userRoleId ? [userRoleId, userRoleId.toString()] : [];

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

        // توزيع الأدوار (Admin, User, Manager...) باستخدام $lookup لجلب اسم الدور
        this.UserModel.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          {
            $lookup: {
              from: 'roles',
              let: { roleId: '$role' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $or: [
                        { $eq: ['$_id', '$$roleId'] },
                        {
                          $eq: [
                            { $toString: '$_id' },
                            { $toString: '$$roleId' },
                          ],
                        },
                      ],
                    },
                  },
                },
              ],
              as: 'roleData',
            },
          },
          {
            $unwind: {
              path: '$roleData',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $group: {
              _id: { $ifNull: ['$roleData.name', 'unknown'] },
              count: { $sum: 1 },
            },
          },
        ]),

        // العملاء الجدد فقط (نستثني الإداريين) خلال الفترة المحددة
        this.UserModel.countDocuments({
          createdAt: { $gte: start, $lte: end },
          role: { $in: userRoleIds },
          isDeleted: { $ne: true },
        }),

        // الخط الزمني للتسجيلات اليومية للعملاء الجدد (لرسم Chart)
        this.UserModel.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              role: { $in: userRoleIds },
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
