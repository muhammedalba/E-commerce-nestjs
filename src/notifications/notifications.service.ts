import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationType,
} from './shared/schemas/Notification.schema';

/**
 * Service responsible for managing persistent notifications within MongoDB.
 * Handles the creation, retrieval, status updates, and granular soft deletion
 * of both direct user notifications and system-wide broadcasts.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  /**
   * Creates and persists a direct notification addressed to a specific user.
   *
   * @param event - The notification event details.
   * @param event.userId - The unique identifier of the recipient user.
   * @param event.action - The specific action code associated with the event (e.g., 'FORCE_LOGOUT', 'ORDER_DELIVERED').
   * @param event.message - The localized human-readable message to display to the user.
   * @param event.payload - Optional metadata or contextual data associated with the notification.
   * @returns A promise that resolves to the saved notification document.
   */
  async createDirect(event: {
    userId: string;
    action: string;
    message: string;
    payload?: unknown;
  }) {
    const newNotification = new this.notificationModel({
      type: NotificationType.DIRECT,
      recipient: new Types.ObjectId(event.userId),
      action: event.action,
      message: event.message,
      payload: event.payload || {},
    });
    return await newNotification.save();
  }

  /**
   * Creates and persists a system-wide broadcast notification addressed to all users.
   *
   * @param event - The broadcast event details.
   * @param event.action - The specific action code associated with the broadcast.
   * @param event.message - The localized human-readable message to display to all users.
   * @param event.payload - Optional metadata or contextual data associated with the broadcast.
   * @returns A promise that resolves to the saved broadcast notification document.
   */
  async createBroadcast(event: {
    action: string;
    message: string;
    payload?: unknown;
  }) {
    const newNotification = new this.notificationModel({
      type: NotificationType.BROADCAST,
      recipient: null,
      action: event.action,
      message: event.message,
      payload: event.payload || {},
    });
    return await newNotification.save();
  }

  /**
   * Retrieves a paginated list of active notifications for a specific user.
   * Includes both direct notifications addressed to the user and system-wide broadcasts,
   * while automatically filtering out notifications deleted by the user or by administrators.
   *
   * @param userId - The unique identifier of the user requesting notifications.
   * @param page - The current page number (1-indexed, defaults to 1).
   * @param limit - The maximum number of notifications to return per page (defaults to 20).
   * @returns A promise resolving to a paginated result containing total count, pagination metadata, and notification documents.
   */
  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const userObjId = new Types.ObjectId(userId);
    const filter = {
      $or: [{ recipient: userObjId }, { type: NotificationType.BROADCAST }],
      deletedByAdmin: false,
      deletedByUsers: { $ne: userObjId },
    };

    const total = await this.notificationModel.countDocuments(filter);
    const notifications = await this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: notifications,
    };
  }
  /**
   * Retrieves a paginated list of all active notifications system-wide.
   * Exclusively used by administrators to see a complete history of all broadcasts and direct messages.
   *
   * @param page - The current page number (1-indexed, defaults to 1).
   * @param limit - The maximum number of notifications to return per page (defaults to 20).
   * @returns A promise resolving to a paginated result containing all notification documents.
   */
  async getAllNotificationsByAdmin(page = 1, limit = 20) {
    const filter = {
      deletedByAdmin: false,
    };

    const total = await this.notificationModel.countDocuments(filter);
    const notifications = await this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('recipient', 'name email')
      .lean()
      .exec();

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: notifications,
    };
  }
  /**
   * Marks a specific notification as read by the user, updating its read status and timestamp.
   * Ensures the user is authorized to access the notification before updating.
   *
   * @param notificationId - The unique identifier of the notification to mark as read.
   * @param userId - The unique identifier of the user performing the action.
   * @returns A promise resolving to the updated notification document.
   * @throws {NotFoundException} If the notification is not found, does not belong to the user, or has been deleted.
   */
  async markAsRead(notificationId: string, userId: string) {
    const userObjId = new Types.ObjectId(userId);
    const notification = await this.notificationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        $or: [{ recipient: userObjId }, { type: NotificationType.BROADCAST }],
        deletedByAdmin: false,
        deletedByUsers: { $ne: userObjId },
      },
      {
        $set: { isRead: true, readAt: new Date() },
      },
      { new: true },
    );

    if (!notification) {
      throw new NotFoundException('الإشعار غير موجود أو محذوف');
    }

    return notification;
  }

  /**
   * Performs a soft deletion of a notification for a specific user.
   * For broadcast notifications or shared direct notifications, this adds the user's ID to the `deletedByUsers` array,
   * ensuring the notification is hidden from their view without affecting other users in the system.
   *
   * @param notificationId - The unique identifier of the notification to delete.
   * @param userId - The unique identifier of the user requesting the deletion.
   * @returns A promise resolving to a success confirmation object.
   * @throws {NotFoundException} If the notification is not found or has already been deleted.
   */
  async deleteByUser(notificationId: string, userId: string) {
    const userObjId = new Types.ObjectId(userId);
    const notification = await this.notificationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        $or: [{ recipient: userObjId }, { type: NotificationType.BROADCAST }],
        deletedByAdmin: false,
      },
      {
        $addToSet: { deletedByUsers: userObjId },
      },
      { new: true },
    );

    if (!notification) {
      throw new NotFoundException('الإشعار غير موجود أو محذوف');
    }

    return { success: true, message: 'تم حذف الإشعار بنجاح' };
  }

  /**
   * Performs an administrative soft deletion of a notification across the entire system.
   * Sets the `deletedByAdmin` flag to true, instantly hiding the notification from all users.
   *
   * @param notificationId - The unique identifier of the notification to delete globally.
   * @returns A promise resolving to an administrative success confirmation object.
   * @throws {NotFoundException} If the notification is not found in the database.
   */
  async deleteByAdmin(notificationId: string) {
    const notification = await this.notificationModel.findByIdAndUpdate(
      notificationId,
      {
        $set: { deletedByAdmin: true },
      },
      { new: true },
    );

    if (!notification) {
      throw new NotFoundException('الإشعار غير موجود');
    }

    return { success: true, message: 'تم حذف الإشعار من قِبل الإدارة بنجاح' };
  }
}
