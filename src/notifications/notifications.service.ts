import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Model, Types, FilterQuery } from 'mongoose';
import {
  Notification,
  NotificationType,
} from './shared/schemas/Notification.schema';
import { User, UserDocument } from 'src/auth/shared/schema/user.schema';

/**
 * Service responsible for managing persistent notifications within MongoDB.
 * Handles the creation, retrieval, status updates, and granular soft deletion
 * of direct user notifications, system broadcasts, and role-targeted notifications.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Helper function to extract a string representation of user's role ID.
   */
  private getRoleIdString(
    user: { role?: Types.ObjectId | { _id: Types.ObjectId } } | null,
  ): string | null {
    if (!user || !user.role) return null;
    if (user.role instanceof Types.ObjectId) {
      return user.role.toString();
    }
    if (typeof user.role === 'object' && '_id' in user.role && user.role._id) {
      return user.role._id.toString();
    }
    return '';
  }

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
   * Creates and persists a role-targeted notification.
   *
   * @param event - The role-targeted notification event details.
   * @param event.roleId - The role ID targeting a specific group of users.
   * @param event.action - The specific action code associated with the event.
   * @param event.message - The localized message to display.
   * @param event.payload - Optional metadata.
   * @returns A promise that resolves to the saved notification document.
   */
  async createRoleNotification(event: {
    roleId: string;
    action: string;
    message: string;
    payload?: unknown;
  }) {
    const newNotification = new this.notificationModel({
      type: NotificationType.ROLE,
      recipient: null,
      targetRole: new Types.ObjectId(event.roleId),
      action: event.action,
      message: event.message,
      payload: event.payload || {},
    });
    return await newNotification.save();
  }

  /**
   * Retrieves the role ID of a specific user.
   *
   * @param userId - The unique user identifier.
   * @returns A promise resolving to the role ID string, or null if not found.
   */
  async getUserRoleId(userId: string): Promise<string | null> {
    const cacheKey = `user_role_${userId}`;
    const cachedRole = await this.cacheManager.get<string>(cacheKey);
    if (cachedRole) {
      return cachedRole;
    }

    const user = await this.userModel
      .findById(userId)
      .select('role')
      .lean()
      .exec();

    const roleStr = this.getRoleIdString(user);
    if (roleStr) {
      // Cache for 1 hour
      await this.cacheManager.set(cacheKey, roleStr, 3600000);
    }
    return roleStr;
  }

  /**
   * Retrieves a paginated list of active notifications for a specific user.
   * Includes direct notifications, system broadcasts, and role-targeted notifications,
   * while automatically filtering out notifications deleted by the user or by administrators.
   *
   * @param userId - The unique identifier of the user requesting notifications.
   * @param page - The current page number (1-indexed, defaults to 1).
   * @param limit - The maximum number of notifications to return per page (defaults to 20).
   * @returns A promise resolving to a paginated result containing total count, pagination metadata, and notification documents.
   */
  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const userObjId = new Types.ObjectId(userId);
    const roleIdStr = await this.getUserRoleId(userId);
    const userRoleId = roleIdStr ? new Types.ObjectId(roleIdStr) : null;

    const orConditions: Array<Record<string, any>> = [
      { recipient: userObjId },
      { type: NotificationType.BROADCAST },
    ];

    if (userRoleId) {
      orConditions.push({
        type: NotificationType.ROLE,
        targetRole: userRoleId,
      });
    }

    const filter: FilterQuery<Notification> = {
      $or: orConditions,
      deletedByAdmin: false,
      deletedByUsers: { $ne: userObjId } as any,
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
   * Exclusively used by administrators to see a complete history of all broadcasts, direct, and role-targeted messages.
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
      .populate('targetRole', 'name')
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
    const roleIdStr = await this.getUserRoleId(userId);
    const userRoleId = roleIdStr ? new Types.ObjectId(roleIdStr) : null;

    const orConditions: Array<Record<string, any>> = [
      { recipient: userObjId },
      { type: NotificationType.BROADCAST },
    ];

    if (userRoleId) {
      orConditions.push({
        type: NotificationType.ROLE,
        targetRole: userRoleId,
      });
    }

    const filter: FilterQuery<Notification> = {
      _id: new Types.ObjectId(notificationId),
      $or: orConditions,
      deletedByAdmin: false,
      deletedByUsers: { $ne: userObjId } as any,
    };

    const notification = await this.notificationModel.findOneAndUpdate(
      filter,
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
   * For broadcast or role-targeted notifications, this adds the user's ID to the `deletedByUsers` array,
   * ensuring the notification is hidden from their view without affecting other users in the system.
   *
   * @param notificationId - The unique identifier of the notification to delete.
   * @param userId - The unique identifier of the user requesting the deletion.
   * @returns A promise resolving to a success confirmation object.
   * @throws {NotFoundException} If the notification is not found or has already been deleted.
   */
  async deleteByUser(notificationId: string, userId: string) {
    const userObjId = new Types.ObjectId(userId);
    const roleIdStr = await this.getUserRoleId(userId);
    const userRoleId = roleIdStr ? new Types.ObjectId(roleIdStr) : null;

    const orConditions: Array<Record<string, any>> = [
      { recipient: userObjId },
      { type: NotificationType.BROADCAST },
    ];

    if (userRoleId) {
      orConditions.push({
        type: NotificationType.ROLE,
        targetRole: userRoleId,
      });
    }

    const filter: FilterQuery<Notification> = {
      _id: new Types.ObjectId(notificationId),
      $or: orConditions,
      deletedByAdmin: false,
    };

    const notification = await this.notificationModel.findOneAndUpdate(
      filter,
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
