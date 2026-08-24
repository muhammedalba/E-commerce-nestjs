import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import {
  FileAsset,
  StorageProviderType,
} from 'src/shared/schema/file-asset.schema';
import { IStorageProvider } from '../interfaces/storage-provider.interface';
import {
  getUploadsRoot,
  resolveToFilesystem,
} from 'src/shared/utils/upload-path.util';

/**
 * Provides storage capabilities using the local filesystem.
 * Handles uploading, image optimization, and deletion of file assets stored locally.
 */
@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  readonly providerType: StorageProviderType = 'local';
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly IMAGE_FORMAT = process.env.IMAGE_FORMAT || 'webp';
  private readonly IMAGE_QUALITY = parseInt(
    process.env.IMAGE_QUALITY || '80',
    10,
  );

  /**
   * Uploads and optionally optimizes a single file to the local filesystem.
   *
   * @param {MulterFileType} file - The file to be uploaded.
   * @param {string} modelName - The name of the model/entity (used to determine the destination directory).
   * @param {{ width: number; height: number }} [dimensions] - Optional dimensions to resize the image to.
   * @returns {Promise<FileAsset>} A promise resolving to the uploaded file asset metadata.
   * @throws {InternalServerErrorException} If the file buffer is undefined or the file fails to save.
   */
  async saveFile(
    file: MulterFileType,
    modelName: string,
    dimensions?: { width: number; height: number },
  ): Promise<FileAsset> {
    if (!file?.buffer) {
      throw new InternalServerErrorException('File buffer is undefined');
    }

    try {
      const uploadsRoot = getUploadsRoot();
      const destinationPath = path.join(uploadsRoot, modelName);

      const timestamp = Date.now();
      const ext = path.extname(file.originalname).toLowerCase();
      const isPdf = ext === '.pdf';
      const finalExt = isPdf ? '.pdf' : `.${this.IMAGE_FORMAT}`;
      const filename = `${file.fieldname}-${timestamp}-${uuidv4()}${finalExt}`;
      const outputPath = path.join(destinationPath, filename);

      await fs.mkdir(destinationPath, { recursive: true });

      if (isPdf) {
        await fs.writeFile(outputPath, file.buffer);
      } else {
        await this.processImage(file.buffer, outputPath, dimensions);
      }

      const uploadsRoute =
        `/${process.env.UPLOADS_FOLDER || 'uploads'}`.replace(/\/+$/, '');
      const relativePath = `${uploadsRoute}/${modelName}/${filename}`;

      return {
        url: relativePath,
        publicId: relativePath,
        provider: 'local',
      };
    } catch (error) {
      this.logger.error(`Error saving local file ${file.originalname}`, error);
      throw new InternalServerErrorException(
        'Failed to save file to local disk',
      );
    }
  }

  /**
   * Uploads multiple files to the local filesystem in parallel.
   *
   * @param {MulterFileType[]} files - An array of files to upload.
   * @param {string} modelName - The name of the model/entity for folder structure organization.
   * @param {{ width: number; height: number }} [dimensions] - Optional dimensions to resize images to.
   * @returns {Promise<FileAsset[]>} A promise resolving to an array of uploaded file asset metadata.
   */
  async saveFiles(
    files: MulterFileType[],
    modelName: string,
    dimensions?: { width: number; height: number },
  ): Promise<FileAsset[]> {
    if (!files?.length) return [];
    return Promise.all(
      files.map((file) => this.saveFile(file, modelName, dimensions)),
    );
  }

  /**
   * Deletes a file asset from the local filesystem.
   * Skips deletion for default assets like 'default.png' or 'avatar.png'.
   *
   * @param {FileAsset | string} assetOrPath - The file asset object or its URL/path.
   * @returns {Promise<void>} A promise that resolves when the deletion is complete or skipped.
   */
  async deleteFile(assetOrPath: FileAsset | string): Promise<void> {
    const rawPath =
      typeof assetOrPath === 'string' ? assetOrPath : assetOrPath.url;

    if (!rawPath) return;

    if (rawPath.includes('default.png') || rawPath.includes('avatar.png')) {
      return;
    }

    try {
      let cleanShortPath = rawPath;
      if (rawPath.startsWith('http')) {
        cleanShortPath = new URL(rawPath).pathname;
      } else {
        const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
        cleanShortPath = rawPath.replace(baseUrl, '');
      }

      let absolutePath: string;
      try {
        absolutePath = resolveToFilesystem(cleanShortPath);
      } catch (pathError) {
        this.logger.warn(
          `Unsafe or invalid local path rejected for deletion: "${cleanShortPath}" — ${(pathError as Error).message}`,
        );
        return;
      }

      await fs.access(absolutePath);
      await fs.unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Error deleting local file ${rawPath}`, error);
      }
    }
  }

  /**
   * Deletes multiple file assets from the local filesystem.
   *
   * @param {(FileAsset | string)[]} assetsOrPaths - An array of file assets or their URLs/paths.
   * @returns {Promise<void>} A promise that resolves when all deletions are complete.
   */
  async deleteFiles(assetsOrPaths: (FileAsset | string)[]): Promise<void> {
    if (!assetsOrPaths?.length) return;
    await Promise.all(assetsOrPaths.map((item) => this.deleteFile(item)));
  }

  /**
   * Optimizes an image buffer by resizing and converting it to the designated format.
   *
   * @param {Buffer} buffer - The raw image buffer.
   * @param {string} outputPath - The absolute path where the optimized image will be saved.
   * @param {{ width: number; height: number }} [dimensions] - Optional dimensions for resizing.
   * @returns {Promise<void>} A promise resolving when the image processing and saving is complete.
   */
  private async processImage(
    buffer: Buffer,
    outputPath: string,
    dimensions?: { width: number; height: number },
  ): Promise<void> {
    const { width, height } = dimensions || { width: 600, height: 600 };
    await sharp(buffer)
      .resize({
        width,
        height,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat(this.IMAGE_FORMAT as keyof sharp.FormatEnum, {
        quality: this.IMAGE_QUALITY,
      })
      .toFile(outputPath);
  }
}
