import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { Request } from 'express';
import { withBaseUrl as _withBaseUrl } from 'src/shared/utils/with-base-url.util';
import {
  FileAsset,
  StorageProviderType,
} from 'src/shared/schema/file-asset.schema';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { SettingsService } from 'src/settings/settings.service';

type filesType = Request['files'];

const IMAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  image: { width: 600, height: 600 },
  imageCover: { width: 600, height: 600 },
  images: { width: 600, height: 600 },
  avatar: { width: 200, height: 200 },
  carouselSm: { width: 480, height: 240 },
  carouselMd: { width: 800, height: 400 },
  carouselLg: { width: 1200, height: 600 },
  transferReceiptImg: { width: 1200, height: 1024 },
  DeliveryReceiptImage: { width: 1200, height: 1024 },
  logo: { width: 500, height: 300 },
  favicon: { width: 64, height: 64 },
};

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(
    private readonly localProvider: LocalStorageProvider,
    private readonly cloudinaryProvider: CloudinaryStorageProvider,
    @Inject(forwardRef(() => SettingsService))
    private readonly settingsService: SettingsService,
  ) {}

  private async getActiveProvider(): Promise<
    LocalStorageProvider | CloudinaryStorageProvider
  > {
    try {
      const providerType: StorageProviderType =
        await this.settingsService.getStorageProvider();
      if (providerType === 'cloudinary') {
        return this.cloudinaryProvider;
      }
    } catch {
      this.logger.warn(
        'Failed to resolve storage provider from settings, falling back to local',
      );
    }
    return this.localProvider;
  }

  // ===========================================================
  // =============  SAVE IMAGE PDF OR FILE =====================
  // ===========================================================
  async saveFileToDisk(
    file: MulterFileType,
    modelName: string,
  ): Promise<FileAsset> {
    if (!file?.buffer) {
      return {
        url: '',
        publicId: '',
        provider: 'local',
      };
    }

    const provider = await this.getActiveProvider();
    const dimensions = IMAGE_DIMENSIONS[file.fieldname];
    return provider.saveFile(file, modelName, dimensions);
  }

  // ===========================================================
  // =============  SAVE MULTIPLE FILES ========================
  // ===========================================================
  async saveFilesToDisk(
    files: filesType,
    destinationPath: string,
  ): Promise<FileAsset[]> {
    if (!files?.length) return [];
    const provider = await this.getActiveProvider();
    const fileArray = files as MulterFileType[];
    return Promise.all(
      fileArray.map((file) =>
        provider.saveFile(
          file,
          destinationPath,
          file?.fieldname ? IMAGE_DIMENSIONS[file.fieldname] : undefined,
        ),
      ),
    );
  }

  // ===========================================================
  // =============  UPDATE FILE ================================
  // ===========================================================
  async updateFile(
    file: MulterFileType,
    modelName: string,
    doc: any,
    oldAsset?: FileAsset | string,
  ): Promise<FileAsset | undefined> {
    try {
      // 1. Upload new file via currently active provider
      const newAsset = await this.saveFileToDisk(file, modelName);

      // 2. Delete old file from its designated provider (smart delete)
      if (oldAsset) {
        await this.deleteFile(oldAsset);
      }

      return newAsset;
    } catch (error) {
      this.logger.error(`Error updating file for model ${modelName}`, error);
      throw error;
    }
  }

  // ===========================================================
  // =============  PREPEND BASE URL TO FILE PATH ==============
  // ===========================================================
  withBaseUrl<T extends FileAsset | string | null | undefined>(input: T): T;
  withBaseUrl<T extends FileAsset | string | null | undefined>(input: T[]): T[];
  withBaseUrl(input: any): any {
    return _withBaseUrl(input);
  }

  // ===========================================================
  // =============  DELETE FILES ===============================
  // ===========================================================
  async deleteFiles(fileAssetsOrPaths: (FileAsset | string)[]): Promise<[]> {
    if (!fileAssetsOrPaths?.length) return [];
    await Promise.all(fileAssetsOrPaths.map((item) => this.deleteFile(item)));
    return [];
  }

  // ===========================================================
  // =============  DELETE FILE ================================
  // ===========================================================
  async deleteFile(assetOrPath: FileAsset | string): Promise<void> {
    if (!assetOrPath) {
      this.logger.warn('No asset or path provided for file deletion.');
      return;
    }

    const url = typeof assetOrPath === 'string' ? assetOrPath : assetOrPath.url;
    const provider =
      typeof assetOrPath === 'object' && assetOrPath !== null
        ? assetOrPath.provider
        : undefined;

    if (url && (url.includes('default.png') || url.includes('avatar.png'))) {
      return;
    }

    // Smart provider detection:
    // If provider is explicitly 'cloudinary' or URL points to cloudinary.com
    if (
      provider === 'cloudinary' ||
      (url && url.includes('res.cloudinary.com'))
    ) {
      await this.cloudinaryProvider.deleteFile(assetOrPath);
      return;
    }

    // Otherwise delete locally
    await this.localProvider.deleteFile(assetOrPath);
  }
}
