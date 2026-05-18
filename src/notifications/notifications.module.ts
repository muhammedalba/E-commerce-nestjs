import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsEventListener } from './notifications-event.listener';
import {
  Notification,
  NotificationSchema,
} from './shared/schemas/Notification.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsEventListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
