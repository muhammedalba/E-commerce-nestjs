import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import {
  FileAsset,
  StorageProviderType,
} from 'src/shared/schema/file-asset.schema';
import { IStorageProvider } from '../interfaces/storage-provider.interface';
import { CLOUDINARY_CONNECTION } from './cloudinary.module';

/**
 * Cloudinary storage provider implementation handling file management.
 *
 * Offloads image optimization and resizing to Cloudinary's cloud pipeline
 * and provides high-performance single and bulk file operations.
 *
 * @implements {IStorageProvider}
 * @implements {OnModuleInit}
 */
@Injectable()
export class CloudinaryStorageProvider implements IStorageProvider {
  readonly providerType: StorageProviderType = 'cloudinary';
  private readonly logger = new Logger(CloudinaryStorageProvider.name);

  constructor(
    @Inject(CLOUDINARY_CONNECTION)
    private readonly _cloudinary: typeof cloudinary,
  ) {}

  /**
   * Uploads a single file stream to Cloudinary with optional cloud-side transformations.
   *
   * Image assets automatically leverage Cloudinary dynamic formatting (`f_auto`)
   * and quality optimization (`q_auto`) to minimize server memory and CPU utilization.
   *
   * @param {MulterFileType} file - Uploaded file object containing memory buffer and metadata.
   * @param {string} modelName - Domain model or entity name used to organize storage sub-folders.
   * @param {{ width: number; height: number }} [dimensions] - Optional target dimensions for image constraints.
   *
   * @returns {Promise<FileAsset>} Metadata of the uploaded file asset including CDN URL and public ID.
   *
   * @throws {BadRequestException} If the file buffer is missing or unreadable.
   * @throws {InternalServerErrorException} If the stream upload process fails on Cloudinary's network.
   */
  async saveFile(
    file: MulterFileType,
    modelName: string,
    dimensions?: { width: number; height: number },
  ): Promise<FileAsset> {
    if (!file?.buffer) {
      throw new BadRequestException('File buffer is missing or empty');
    }

    const rootFolder = process.env.CLOUDINARY_ROOT_FOLDER || 'codeprops';
    const folder = `${rootFolder}/${modelName}`;
    const isPdf = file.mimetype === 'application/pdf';
    const resourceType = isPdf ? 'raw' : 'image';
    const filename = `${file.fieldname}-${Date.now()}-${uuidv4()}`;

    const uploadOptions: Record<string, any> = {
      folder,
      public_id: filename,
      resource_type: resourceType,
    };

    if (!isPdf) {
      const defaultWidth = dimensions?.width || 600;
      const defaultHeight = dimensions?.height || 600;

      uploadOptions.transformation = [
        {
          width: defaultWidth,
          height: defaultHeight,
          crop: 'limit',
          quality: 'auto',
          fetch_format: 'auto',
        },
      ];
    }

    try {
      const uploadResult = await new Promise<UploadApiResponse>(
        (resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                return reject(
                  new Error(error.message || 'Cloudinary upload stream failed'),
                );
              }
              if (!result)
                return reject(new Error('Cloudinary stream response empty'));
              resolve(result);
            },
          );
          uploadStream.end(file.buffer);
        },
      );

      return {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        provider: this.providerType,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace';

      this.logger.error(
        `Failed to upload ${file.originalname} to Cloudinary: ${errorMessage}`,
        errorStack,
      );

      throw new InternalServerErrorException(
        'Failed to upload file to cloud storage',
      );
    }
  }

  /**
   * Concurrently uploads an array of files to Cloudinary.
   *
   * @param {MulterFileType[]} files - Array of uploaded files to process.
   * @param {string} modelName - Domain model or entity name for folder organization.
   * @param {{ width: number; height: number }} [dimensions] - Optional target dimensions for image constraints.
   *
   * @returns {Promise<FileAsset[]>} Array of resolved file asset metadata objects.
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
   * Removes a single file asset from Cloudinary storage and invalidates CDN cache.
   *
   * @param {FileAsset | string} assetOrPath - Target asset metadata object, raw URL, or public ID.
   * @returns {Promise<void>} Resolves when the deletion attempt completes.
   */
  async deleteFile(assetOrPath: FileAsset | string): Promise<void> {
    const publicId = this.extractPublicId(assetOrPath);
    if (!publicId) return;

    const isPdf =
      typeof assetOrPath === 'string'
        ? assetOrPath.toLowerCase().includes('.pdf')
        : (assetOrPath.url || '').toLowerCase().includes('.pdf');

    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: isPdf ? 'raw' : 'image',
        invalidate: true,
      });
    } catch (error) {
      this.logger.error(`Failed to delete asset: ${publicId}`, error);
    }
  }

  /**
   * Executes bulk deletion of multiple file assets via Cloudinary Admin API.
   *
   * Segregates resources by type (`image` vs `raw`) to issue batch calls,
   * reducing HTTP network overhead.
   *
   * @param {(FileAsset | string)[]} assetsOrPaths - Array of asset objects, URLs, or public IDs to remove.
   * @returns {Promise<void>} Resolves when bulk deletion calls complete.
   */
  async deleteFiles(assetsOrPaths: (FileAsset | string)[]): Promise<void> {
    if (!assetsOrPaths?.length) return;

    const images: string[] = [];
    const rawFiles: string[] = [];

    for (const item of assetsOrPaths) {
      const id = this.extractPublicId(item);
      const url = typeof item === 'string' ? item : item.url || '';
      if (!id) continue;

      if (url.toLowerCase().includes('.pdf')) {
        rawFiles.push(id);
      } else {
        images.push(id);
      }
    }

    try {
      if (images.length > 0) {
        await cloudinary.api.delete_resources(images, {
          resource_type: 'image',
          invalidate: true,
        });
      }
      if (rawFiles.length > 0) {
        await cloudinary.api.delete_resources(rawFiles, {
          resource_type: 'raw',
          invalidate: true,
        });
      }
    } catch (error) {
      this.logger.error('Error performing bulk deletion on Cloudinary', error);
    }
  }

  /**
   * Extracts the unique Cloudinary public ID from a given input string or asset entity.
   *
   * @param {FileAsset | string} assetOrPath - The asset object, URL, or plain public ID string.
   * @returns {string} The parsed Cloudinary public ID, or an empty string if invalid.
   * @private
   */
  private extractPublicId(assetOrPath: FileAsset | string): string {
    if (!assetOrPath) return '';
    if (typeof assetOrPath !== 'string') {
      if (assetOrPath.publicId) return assetOrPath.publicId;
      assetOrPath = assetOrPath.url;
    }
    if (!assetOrPath.startsWith('http')) return assetOrPath;

    const regex = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/;
    const match = assetOrPath.match(regex);
    return match ? match[1] : assetOrPath;
  }
}
