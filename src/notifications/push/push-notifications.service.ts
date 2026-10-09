import { Injectable, Logger } from '@nestjs/common';
import { DeviceTokensService } from './device-tokens.service';
import { FcmClient } from './fcm.client';

type Localized = { ar: string; en: string };

/** A push addressed to a person; written in every device's own language. */
export interface UserPush {
  title: Localized;
  body: Localized;
  data?: Record<string, string>;
  collapseKey?: string;
}

/**
 * Delivers pushes to all live devices of a user and forgets the tokens FCM
 * reports as dead. Knows nothing about orders or reviews — callers decide
 * what to say.
 */
@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private readonly fcm: FcmClient,
    private readonly deviceTokens: DeviceTokensService,
  ) {}

  async sendToUser(userId: string, push: UserPush): Promise<void> {
    if (!this.fcm.isEnabled()) return;

    const devices = await this.deviceTokens.activeDevices(userId);
    if (!devices.length) return;

    const results = await Promise.all(
      devices.map((device) =>
        this.fcm.send({
          token: device.token,
          title: push.title[device.lang],
          body: push.body[device.lang],
          data: push.data,
          collapseKey: push.collapseKey,
        }),
      ),
    );

    const dead = devices
      .filter((_, i) => results[i] === 'invalid-token')
      .map((d) => d.token);
    if (dead.length) {
      await this.deviceTokens.remove(dead);
      this.logger.log(`Dropped ${dead.length} dead device token(s)`);
    }
  }
}
