import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RefreshToken,
  refreshTokenSchema,
} from 'src/auth/shared/schema/refresh-token.schema';
import { DeviceTokensService } from './device-tokens.service';
import { FcmClient } from './fcm.client';
import { PushDevicesController } from './push-devices.controller';
import { PushNotificationsListener } from './push-notifications.listener';
import { PushNotificationsService } from './push-notifications.service';
import { DeviceToken, DeviceTokenSchema } from './schemas/device-token.schema';

/** Phone push notifications (FCM) for the mobile app. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeviceToken.name, schema: DeviceTokenSchema },
      { name: RefreshToken.name, schema: refreshTokenSchema },
    ]),
  ],
  controllers: [PushDevicesController],
  providers: [
    FcmClient,
    DeviceTokensService,
    PushNotificationsService,
    PushNotificationsListener,
  ],
  exports: [PushNotificationsService],
})
export class PushModule {}
