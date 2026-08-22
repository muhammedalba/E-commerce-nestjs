import { Module, forwardRef } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [forwardRef(() => SettingsModule)],
  providers: [
    FileUploadService,
    LocalStorageProvider,
    CloudinaryStorageProvider,
  ],
  exports: [FileUploadService, LocalStorageProvider, CloudinaryStorageProvider],
})
export class FileUploadDiskStorageModule {}
