import { Global, Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { CloudinaryModule } from './providers/cloudinary.module';
import { SettingsModule } from '../settings/settings.module';

@Global()
@Module({
  imports: [SettingsModule, CloudinaryModule],
  providers: [
    FileUploadService,
    LocalStorageProvider,
    CloudinaryStorageProvider,
  ],
  exports: [FileUploadService, LocalStorageProvider, CloudinaryStorageProvider],
})
export class FileUploadDiskStorageModule {}
