import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import {
  MulterFilesType,
  MulterFileType,
} from 'src/shared/utils/interfaces/fileInterface';
// import { Request } from 'express';
import { withBaseUrl as _withBaseUrl } from 'src/shared/utils/with-base-url.util';
import {
  FileAsset,
  StorageProviderType,
} from 'src/shared/schema/file-asset.schema';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { SettingsService } from 'src/settings/settings.service';

// type filesType = Request['files'];

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

/**
 * Service responsible for handling file uploads, updates, and deletions.
 * It dynamically routes file operations to the active storage provider (e.g., local or Cloudinary)
 * based on application settings and handles formatting asset URLs.
 */
@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(
    private readonly localProvider: LocalStorageProvider,
    private readonly cloudinaryProvider: CloudinaryStorageProvider,
    @Inject(forwardRef(() => SettingsService))
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Retrieves the currently active storage provider based on application settings.
   * Falls back to the local storage provider if the setting cannot be resolved.
   *
   * @returns {Promise<LocalStorageProvider | CloudinaryStorageProvider>} The active storage provider instance.
   */
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
  /**
   * Saves a single file to the active storage provider.
   * Resolves the appropriate image dimensions based on the file field name.
   *
   * @param {MulterFileType} file - The file to upload.
   * @param {string} modelName - The name of the model/entity (used for folder structuring).
   * @returns {Promise<FileAsset>} A promise resolving to the saved file asset metadata.
   */
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
  /**
   * Saves multiple files to the active storage provider in parallel.
   * Resolves the appropriate dimensions for each file based on its field name.
   *
   * @param {MulterFilesType} files - The files to upload.
   * @param {string} destinationPath - The folder or model name used for organizing the files.
   * @returns {Promise<FileAsset[]>} A promise resolving to an array of saved file asset metadata.
   */
  async saveFilesToDisk(
    files: MulterFilesType,
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
  /**
   * Updates an existing file asset by uploading a new file and then deleting the old one.
   * Deletion uses smart provider detection to remove the old asset from its respective storage.
   *
   * @param {MulterFileType} file - The new file to upload.
   * @param {string} modelName - The name of the model/entity associated with the file.
   * @param {any} doc - Optional document context (currently unused but preserved for signature compatibility).
   * @param {FileAsset | string} [oldAsset] - The existing file asset or URL to be deleted.
   * @returns {Promise<FileAsset | undefined>} A promise resolving to the new file asset metadata.
   */
  async updateFile(
    file: MulterFileType,
    modelName: string,
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
  // =============  DELETE FILE ================================
  // ===========================================================
  /**
   * Deletes a single file asset from storage.
   * Intelligently detects whether to delete from Cloudinary or local storage based on the asset's provider or URL.
   * Skips deletion for system default assets.
   *
   * @param {FileAsset | string} assetOrPath - The file asset object or its URL/path.
   * @returns {Promise<void>} A promise that resolves when the file is successfully deleted.
   */
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

  // ===========================================================
  // =============  DELETE FILES ===============================
  // ===========================================================
  /**
   * Deletes multiple file assets in parallel using smart provider detection.
   *
   * @param {(FileAsset | string)[]} fileAssetsOrPaths - An array of file assets or their URLs/paths.
   * @returns {Promise<[]>} A promise resolving to an empty array upon completion.
   */
  async deleteFiles(fileAssetsOrPaths: (FileAsset | string)[]): Promise<[]> {
    if (!fileAssetsOrPaths?.length) return [];
    await Promise.all(fileAssetsOrPaths.map((item) => this.deleteFile(item)));
    return [];
  }

  // ===========================================================
  // =============  PREPEND BASE URL TO FILE PATH ==============
  // ===========================================================
  /**
   * Prepends the base URL to a file asset or array of file assets, if required.
   * Used for transforming relative local paths into absolute URLs before returning them to the client.
   *
   * @template T
   * @param {T | T[]} input - The file asset(s) or URL(s) to process.
   * @returns {T | T[]} The processed asset(s) with fully qualified URLs.
   */
  withBaseUrl<T extends FileAsset | string | null | undefined>(input: T): T;
  withBaseUrl<T extends FileAsset | string | null | undefined>(input: T[]): T[];
  withBaseUrl(input: unknown): unknown {
    return _withBaseUrl(input as any) as unknown;
  }
}
