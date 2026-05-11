import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { Setting, SettingSchema } from './shared/schema/setting.schema';
import { AuthModule } from '../auth/auth.module';
import { FileUploadDiskStorageModule } from '../file-upload/file-upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Setting.name, schema: SettingSchema }]),
    AuthModule,
    FileUploadDiskStorageModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService], // مهم: نصدره ليستخدمه CheckoutModule و OrderModule
})
export class SettingsModule {}
