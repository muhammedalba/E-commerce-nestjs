import {
  Controller,
  Sse,
  UseGuards,
  Req,
  MessageEvent,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Post,
  Body,
  BadRequestException,
  Header,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEventPattern, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthGuard } from '../auth/shared/guards/auth.guard';
import { PermissionsGuard } from '../roles/shared/guards/permissions.guard';
import { RequirePermission } from '../roles/shared/decorators/require-permission.decorator';
import { Permissions } from '../roles/shared/enums/permissions.enum';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { CustomI18nService } from '../shared/utils/i18n/custom-i18n.service';
import { JwtPayload } from '../auth/shared/types/jwt-payload.interface';
import {
  SendNotificationDto,
  NotificationTargetType,
} from './shared/dto/send-notification.dto';

interface NotificationEvent {
  userId?: string;
  action: string;
  message: string;
  payload?: unknown;
}

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: JwtPayload;
}

/**
 * Controller handling REST API endpoints and Server-Sent Events (SSE) for the notification system.
 * Provides endpoints for retrieving, updating, and deleting user notifications, as well as administrative management.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsService: NotificationsService,
    private readonly i18n: CustomI18nService,
  ) {}

  /**
   * Establishes a Server-Sent Events (SSE) stream for real-time notification delivery.
   * Dynamically subscribes to both the authenticated user's dedicated event channel (`user.notification.${userId}`)
   * and the system-wide broadcast channel (`system.broadcast`) using RxJS `merge`.
   * Uses modern `fromEventPattern` to avoid RxJS deprecation warnings and ensure clean listener cleanup.
   *
   * @param req - The incoming authenticated Express request containing the user's JWT payload.
   * @returns An observable stream of formatted MessageEvent objects representing real-time notifications.
   */
  @UseGuards(AuthGuard)
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('Connection', 'keep-alive')
  @Header('X-Accel-Buffering', 'no')
  @Sse('stream')
  stream(@Req() req: AuthenticatedRequest): Observable<MessageEvent> {
    const userId = req.user?.user_id;
    console.log(`Subscribing SSE for user: user.notification.${userId}`);

    const userStream$ = fromEventPattern<NotificationEvent>(
      (handler) => this.eventEmitter.on(`user.notification.${userId}`, handler),
      (handler) =>
        this.eventEmitter.off(`user.notification.${userId}`, handler),
    );

    const broadcastStream$ = fromEventPattern<NotificationEvent>(
      (handler) => this.eventEmitter.on('system.broadcast', handler),
      (handler) => this.eventEmitter.off('system.broadcast', handler),
    );

    return merge(userStream$, broadcastStream$).pipe(
      map((event) => ({
        data: {
          action: event.action,
          message: event.message,
          payload: event.payload,
        },
      })),
    );
  }

  /**
   * Retrieves a paginated list of all notifications system-wide.
   * Restricted to administrative users possessing the `UPDATE_SETTINGS` permission.
   *
   * @param page - The page number to retrieve (defaults to '1').
   * @param limit - The number of items per page (defaults to '20').
   * @returns An object containing success status, pagination metadata, and the list of all notifications.
   */
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(Permissions.UPDATE_SETTINGS)
  @Get('admin')
  async getAllAdminNotifications(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const result = await this.notificationsService.getAllNotificationsByAdmin(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return { success: true, ...result };
  }

  /**
   * Retrieves a paginated list of active notifications (both direct and broadcast) for the authenticated user.
   *
   * @param req - The incoming authenticated Express request.
   * @param page - The page number to retrieve (defaults to '1').
   * @param limit - The number of items per page (defaults to '20').
   * @returns An object containing success status, pagination metadata, and the list of notifications.
   */
  @UseGuards(AuthGuard)
  @Get()
  async getUserNotifications(
    @Req() req: AuthenticatedRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const userId = req.user?.user_id;
    if (!userId) {
      return { success: false, message: 'غير مصرح' };
    }
    const result = await this.notificationsService.getUserNotifications(
      userId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return { success: true, ...result };
  }

  /**
   * Marks a specific notification as read for the authenticated user.
   *
   * @param id - The unique identifier of the notification.
   * @param req - The incoming authenticated Express request.
   * @returns An object containing success status and the updated notification data.
   */
  @UseGuards(AuthGuard)
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.user_id;
    if (!userId) {
      return { success: false, message: 'غير مصرح' };
    }
    const notification = await this.notificationsService.markAsRead(id, userId);
    return { success: true, data: notification };
  }

  /**
   * Soft-deletes a specific notification from the authenticated user's view.
   * For broadcast notifications, adds the user's ID to the exclusion list without affecting others.
   *
   * @param id - The unique identifier of the notification to delete.
   * @param req - The incoming authenticated Express request.
   * @returns An object confirming successful deletion.
   */
  @UseGuards(AuthGuard)
  @Delete(':id')
  async deleteNotification(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.user_id;
    if (!userId) {
      return { success: false, message: 'غير مصرح' };
    }
    return await this.notificationsService.deleteByUser(id, userId);
  }

  /**
   * Globally soft-deletes a notification across the entire system.
   * Restricted to administrative users possessing the `UPDATE_SETTINGS` permission.
   *
   * @param id - The unique identifier of the notification to delete globally.
   * @returns An object confirming successful administrative deletion.
   */
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(Permissions.UPDATE_SETTINGS)
  @Delete('admin/:id')
  async deleteNotificationByAdmin(@Param('id') id: string) {
    return await this.notificationsService.deleteByAdmin(id);
  }

  /**
   * Allows an administrator to send a real-time and persistent notification to a specific user or broadcast to all users.
   * Restricted to administrative users possessing the `UPDATE_SETTINGS` permission.
   *
   * @param sendNotificationDto - Data transfer object containing target type, optional user ID, action, message, and payload.
   * @returns An object confirming successful emission of the notification.
   * @throws {BadRequestException} If direct target type is selected but no user ID is provided.
   */
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermission(Permissions.UPDATE_SETTINGS)
  @Post('admin/send')
  sendNotificationByAdmin(@Body() sendNotificationDto: SendNotificationDto) {
    const { targetType, userId, action, message, payload } =
      sendNotificationDto;

    if (targetType === NotificationTargetType.DIRECT) {
      if (!userId) {
        throw new BadRequestException(
          this.i18n.translate(
            'exception.notification.USER_ID_REQUIRED_FOR_DIRECT_NOTIFICATION',
          ),
        );
      }

      this.eventEmitter.emit(`user.notification.${userId}`, {
        userId,
        action: action || 'ADMIN_ALERT',
        message,
        payload: payload || {},
      });

      return {
        success: true,
        message: this.i18n.translate('notification.DIRECT_SEND_SUCCESS'),
      };
    } else {
      this.eventEmitter.emit('system.broadcast', {
        action: action || 'ADMIN_BROADCAST',
        message,
        payload: payload || {},
      });

      return {
        success: true,
        message: this.i18n.translate('notification.BROADCAST_SEND_SUCCESS'),
      };
    }
  }
}
