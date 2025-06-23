import { Model } from 'mongoose';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'src/auth/shared/schema/user.schema';
import { Order } from 'src/order/shared/schemas/Order.schema';

@Injectable()
export class UsersStatistics {
  constructor(
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    @InjectModel(Order.name) private readonly OrderModel: Model<Order>,
  ) {}

  async users_statistics() {
    try {
      const today = new Date();

      const [
        totalUsers,
        statusCounts,
        newUsersCurrentMonth,
        topUsersByOrders,
        roleCounts,
      ] = await Promise.all([
        this.UserModel.countDocuments(),

        // تجميع المستخدمين حسب الحالة status
        this.UserModel.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        // المستخدمين الجدد في الشهر الحالي
        this.UserModel.countDocuments({
          createdAt: {
            $gte: startOfMonth(today),
            $lte: endOfMonth(today),
          },
        }),

        // أكثر 5 مستخدمين قاموا بأكبر عدد طلبات (نفترض الطلبات مرتبطة بـ userId في الطلبات)
        this.OrderModel.aggregate([
          {
            $group: {
              _id: '$user',
              totalOrders: { $sum: 1 },
            },
          },
          { $sort: { totalOrders: -1 } },
          { $limit: 5 },
          {
            $addFields: {
              userIdObj: { $toObjectId: '$_id' },
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userIdObj',
              foreignField: '_id',
              as: 'user',
            },
          },
          {
            $project: {
              _id: 0,
              userId: '$_id',
              totalOrders: 1,
              userName: { $arrayElemAt: ['$user.name', 0] },
            },
          },
        ]),

        // توزيع المستخدمين حسب الدور role
        this.UserModel.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } },
        ]),
      ]);

      const statusBreakdown = statusCounts.reduce<Record<string, number>>(
        (acc, curr: { _id: string; count: number }) => {
          acc[curr._id] = curr.count;
          return acc;
        },
        {},
      );

      const roleBreakdown = roleCounts.reduce<Record<string, number>>(
        (acc, curr: { _id: string; count: number }) => {
          acc[curr._id] = curr.count;
          return acc;
        },
        {},
      );

      return {
        status: 'success',
        data: {
          totalUsers,
          statusBreakdown,
          newUsersCurrentMonth,
          topUsersByOrders,
          roleBreakdown,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to fetch users statistics.',
        error,
      };
    }
  }
}
