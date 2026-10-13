import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { tmpdir } from 'os';
import { join } from 'path';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from 'src/audit/audit.module';
import { Role, RoleSchema } from 'src/roles/shared/schemas/role.schema';
import {
  Setting,
  SettingSchema,
} from 'src/settings/shared/schema/setting.schema';
import {
  Country,
  CountrySchema,
} from 'src/locations/shared/schema/country.schema';
import { BackupAdminService } from './backup-admin.service';
import { BackupAlerts } from './backup-alerts';
import { BackupConfig } from './backup.config';
import {
  BackupController,
  BackupDownloadController,
} from './backup.controller';
import { BackupChecksService } from './backup-checks.service';
import { BackupFilesService } from './backup-files.service';
import { BackupLocator } from './backup-locator';
import { BackupOperationsService } from './backup-operations.service';
import { BackupCheck, BackupCheckSchema } from './schemas/backup-check.schema';
import { BackupLocks, GoogleDriveClientFactory } from './backup.locks';
import { BackupProcessor } from './backup.processor';
import { BackupScheduler } from './backup.scheduler';
import { BackupWatchdog } from './backup.watchdog';
import { BackupService } from './backup.service';
import { BackupSettingsStore } from './backup-settings.store';
import { BACKUP_QUEUE, UPLOAD_TEMP_DIR_NAME } from './backup.types';
import { BackupRun, BackupRunSchema } from './schemas/backup-run.schema';
import { UploadsBackupService } from './uploads/uploads-backup.service';
import {
  BackupUploadIndex,
  BackupUploadIndexSchema,
  BackupUploadManifest,
  BackupUploadManifestSchema,
} from './uploads/uploads.schemas';

/**
 * Encrypted, scheduled MongoDB backups to Google Drive (see docs/BACKUP.md).
 * Reuses the app's BullMQ connection, Redis client, mail queue and audit log.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BackupRun.name, schema: BackupRunSchema },
      { name: BackupCheck.name, schema: BackupCheckSchema },
      { name: BackupUploadIndex.name, schema: BackupUploadIndexSchema },
      { name: BackupUploadManifest.name, schema: BackupUploadManifestSchema },
      { name: Setting.name, schema: SettingSchema },
      { name: Country.name, schema: CountrySchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    BullModule.registerQueue({ name: BACKUP_QUEUE }),
    // Failure alerts go through the existing mail queue (EmailModule's worker).
    BullModule.registerQueue({ name: 'mail-queue' }),
    AuditModule,
    // Uploaded backups are streamed to a temp file (ciphertext only), never
    // buffered in memory; size-capped by BACKUP_UPLOAD_MAX_MB.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dir = join(tmpdir(), UPLOAD_TEMP_DIR_NAME);
        mkdirSync(dir, { recursive: true });
        return {
          storage: diskStorage({
            destination: dir,
            filename: (_req, _file, cb) =>
              cb(null, `${randomBytes(16).toString('hex')}.upload`),
          }),
          limits: {
            files: 1,
            fields: 5,
            fileSize:
              (config.get<number>('BACKUP_UPLOAD_MAX_MB') ?? 512) * 1024 * 1024,
          },
        };
      },
    }),
  ],
  controllers: [BackupController, BackupDownloadController],
  providers: [
    BackupConfig,
    BackupAlerts,
    BackupLocks,
    GoogleDriveClientFactory,
    BackupSettingsStore,
    BackupService,
    UploadsBackupService,
    BackupScheduler,
    BackupWatchdog,
    BackupProcessor,
    BackupAdminService,
    BackupLocator,
    BackupChecksService,
    BackupFilesService,
    BackupOperationsService,
  ],
})
export class BackupModule {}
