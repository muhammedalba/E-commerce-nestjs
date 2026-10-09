import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import {
  USER_EVENTS,
  UserDeletedEvent,
} from 'src/users/shared/events/user.events';
import { UserNotificationEvent } from '../shared/types/user-notification.event';
import { DeviceTokensService } from './device-tokens.service';
import {
  DEFAULT_PUSH_TITLE_KEY,
  PUSH_TITLE_KEYS,
  SILENT_ACTIONS,
} from './push.constants';
import {
  PushNotificationsService,
  UserPush,
} from './push-notifications.service';

/**
 * Turns the app's direct user notifications into phone pushes. Runs beside
 * NotificationsEventListener (which stores them), so a push failure never
 * affects the in-app notification list, and vice versa.
 */
@Injectable()
export class PushNotificationsListener {
  private readonly logger = new Logger(PushNotificationsListener.name);

  constructor(
    private readonly push: PushNotificationsService,
    private readonly deviceTokens: DeviceTokensService,
    private readonly i18n: CustomI18nService,
  ) {}

  @OnEvent('user.notification.*', { async: true })
  async handleUserNotification(event: UserNotificationEvent): Promise<void> {
    if (SILENT_ACTIONS.has(event.action)) return;
    try {
      await this.push.sendToUser(event.userId, this.toPush(event));
    } catch (error) {
      this.logger.error(
        `Failed to push ${event.action} to user ${event.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** A deleted account keeps no device tokens. */
  @OnEvent(USER_EVENTS.DELETED, { async: true })
  async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    await this.deviceTokens.removeAllForUser(event.userId);
  }

  private toPush(event: UserNotificationEvent): UserPush {
    const titleKey =
      PUSH_TITLE_KEYS.find(([prefix]) =>
        event.action.startsWith(prefix),
      )?.[1] ?? DEFAULT_PUSH_TITLE_KEY;
    const body =
      typeof event.message === 'string'
        ? { ar: event.message, en: event.message }
        : event.message;
    const data = toStringData(event.payload);

    return {
      title: this.i18n.translateAll(titleKey),
      body,
      data: { ...data, action: event.action },
      // Status updates of one order replace each other in the tray.
      collapseKey: data.orderId ? `order-${data.orderId}` : undefined,
    };
  }
}

/** FCM data values must be strings: ids become strings, objects JSON. */
function toStringData(
  payload: Record<string, unknown> = {},
): Record<string, string> {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;
    data[key] = toDataValue(value);
  }
  return data;
}

function toDataValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  if (value instanceof Types.ObjectId) return value.toHexString();
  return JSON.stringify(value);
}
