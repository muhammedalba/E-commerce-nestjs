import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { Setting, SettingSchema } from './shared/schema/setting.schema';
import { ExchangeRateSyncService } from './exchange-rate-sync.service';
import { Role, RoleSchema } from 'src/roles/shared/schemas/role.schema';
import { AuditModule } from 'src/audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Setting.name, schema: SettingSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    HttpModule,
    AuditModule,
    // Reuses the queue already registered by EmailModule — same Redis-backed
    // queue, so the exchange-rate failure alert is delivered asynchronously
    // exactly like outbound emails are (with retry/backoff).
    BullModule.registerQueue({ name: 'mail-queue' }),
  ],
  controllers: [SettingsController],
  providers: [SettingsService, ExchangeRateSyncService],
  exports: [SettingsService],
})
export class SettingsModule {}
