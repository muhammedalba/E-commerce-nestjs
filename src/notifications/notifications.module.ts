import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsEventListener } from './notifications-event.listener';
import {
  Notification,
  NotificationSchema,
} from './shared/schemas/Notification.schema';
import { User, UserSchema } from 'src/auth/shared/schema/user.schema';
import { Role, RoleSchema } from 'src/roles/shared/schemas/role.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsEventListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
