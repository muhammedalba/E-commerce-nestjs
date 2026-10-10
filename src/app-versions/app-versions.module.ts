import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from 'src/audit/audit.module';
import { PushModule } from 'src/notifications/push/push.module';
import { Role, RoleSchema } from 'src/roles/shared/schemas/role.schema';
import { AppVersionsController } from './app-versions.controller';
import { AppVersionsService } from './app-versions.service';
import {
  AppVersionPolicy,
  AppVersionPolicySchema,
} from './shared/schemas/app-version-policy.schema';

/** Optional / forced update policy of the mobile apps. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppVersionPolicy.name, schema: AppVersionPolicySchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    AuditModule,
    PushModule,
  ],
  controllers: [AppVersionsController],
  providers: [AppVersionsService],
  // AppVersionGuard (global) asks it whether a request's app may still call.
  exports: [AppVersionsService],
})
export class AppVersionsModule {}
