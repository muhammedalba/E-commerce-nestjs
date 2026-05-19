import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';

interface NotificationPayload {
  userId: string;
  action: string;
  message: string;
  payload?: unknown;
}

interface BroadcastPayload {
  action: string;
  message: string;
  payload?: unknown;
}

interface RoleNotificationPayload {
  roleId: string;
  action: string;
  message: string;
  payload?: unknown;
}

/**
 * Event listener responsible for asynchronously persisting notification events triggered across the application.
 * Decouples event emission from database write operations to maintain high system performance.
 */
@Injectable()
export class NotificationsEventListener {
  private readonly logger = new Logger(NotificationsEventListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Asynchronously handles direct user notification events matching the `user.notification.*` wildcard pattern.
   * Persists the notification data to MongoDB via NotificationsService.
   *
   * @param event - The payload containing recipient user ID, action code, message, and optional metadata.
   * @returns A promise that resolves when the notification is processed.
   */
  @OnEvent('user.notification.*', { async: true })
  async handleUserNotification(event: NotificationPayload) {
    try {
      console.log('new user notification event: ', event);
      await this.notificationsService.createDirect(event);
    } catch (error) {
      this.logger.error(
        `Failed to save direct notification for user ${event.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Asynchronously handles role-targeted notification events matching the `role.notification.*` wildcard pattern.
   * Persists the notification data to MongoDB via NotificationsService.
   *
   * @param event - The payload containing role ID, action code, message, and optional metadata.
   * @returns A promise that resolves when the notification is processed.
   */
  @OnEvent('role.notification.*', { async: true })
  async handleRoleNotification(event: RoleNotificationPayload) {
    try {
      console.log('new role notification event: ', event);
      await this.notificationsService.createRoleNotification(event);
    } catch (error) {
      this.logger.error(
        `Failed to save role notification for role ${event.roleId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Asynchronously handles system-wide broadcast events matching `system.broadcast`.
   * Persists the broadcast notification data to MongoDB for global user access.
   *
   * @param event - The payload containing the action code, broadcast message, and optional metadata.
   * @returns A promise that resolves when the broadcast notification is processed.
   */
  @OnEvent('system.broadcast', { async: true })
  async handleSystemBroadcast(event: BroadcastPayload) {
    try {
      console.log('new system broadcast event: ', event);
      await this.notificationsService.createBroadcast(event);
    } catch (error) {
      this.logger.error(
        'Failed to save system broadcast notification',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
