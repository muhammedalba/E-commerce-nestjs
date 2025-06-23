import { Model } from 'mongoose';
import { startOfMonth, endOfMonth, subDays, startOfDay } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Order } from '../schemas/Order.schema';

@Injectable()
export class OrdersStatisticsService {
  constructor(
    @InjectModel(Order.name) private readonly OrderModel: Model<Order>,
  ) {}

  async numbers_of_orders_statistics() {
    try {
      const today: Date = new Date();

      const [
        totalOrders,
        statusCounts,
        currentMonthOrders,
        dailyOrdersRaw,
        topProductsRaw,
        topCustomersRaw,
      ] = await Promise.all([
        this.OrderModel.countDocuments(),

        this.OrderModel.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        this.OrderModel.countDocuments({
          createdAt: {
            $gte: startOfMonth(today),
            $lte: endOfMonth(today),
          },
        }),

        this.OrderModel.aggregate([
          {
            $match: {
              createdAt: { $gte: subDays(startOfDay(today), 6) }, // 7 day
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

        this.OrderModel.aggregate([
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
              productIdObj: { $toObjectId: '$_id' },
            },
          },
          {
            $lookup: {
              from: 'products',
              localField: 'productIdObj',
              foreignField: '_id',
              as: 'products',
            },
          },
          {
            $project: {
              _id: 0,
              productId: '$_id',
              totalQuantity: 1,
              product: { $arrayElemAt: ['$products', 0] },
            },
          },
          {
            $addFields: {
              productName: '$product.title.en',
            },
          },
          {
            $project: {
              product: 0,
            },
          },
        ]),

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
              as: 'users',
            },
          },
          {
            $project: {
              _id: 0,
              userId: '$_id',
              totalOrders: 1,
              user: { $arrayElemAt: ['$users', 0] },
            },
          },
          {
            $addFields: {
              userName: '$user.name',
            },
          },
          {
            $project: {
              user: 0,
            },
          },
        ]),
      ]);

      const statusBreakdown = statusCounts.reduce<Record<string, number>>(
        (acc, curr: { _id: string; count: number }) => {
          acc[curr._id] = curr.count;
          return acc;
        },
        {},
      );

      const dailyOrders = dailyOrdersRaw.map(
        (entry: { _id: string; count: number }) => ({
          date: entry._id,
          count: entry.count,
        }),
      );

      return {
        status: 'success',
        data: {
          totalOrders,
          statusBreakdown,
          currentMonthOrders,
          dailyOrders,
          topProducts: topProductsRaw,
          topCustomers: topCustomersRaw,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to fetch orders statistics.',
        error: error,
      };
    }
  }
}
