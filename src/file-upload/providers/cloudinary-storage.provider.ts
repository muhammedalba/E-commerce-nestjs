import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as path from 'path';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import {
  FileAsset,
  StorageProviderType,
} from 'src/shared/schema/file-asset.schema';
import { IStorageProvider } from '../interfaces/storage-provider.interface';

@Injectable()
export class CloudinaryStorageProvider implements IStorageProvider {
  readonly providerType: StorageProviderType = 'cloudinary';
  private readonly logger = new Logger(CloudinaryStorageProvider.name);

  constructor() {
    this.ensureConfigured();
  }

  ensureConfigured(): boolean {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      return true;
    }
    return false;
  }

  async saveFile(
    file: MulterFileType,
    modelName: string,
    dimensions?: { width: number; height: number },
  ): Promise<FileAsset> {
    if (!this.ensureConfigured()) {
      throw new InternalServerErrorException(
        'Cloudinary credentials are not configured in environment variables',
      );
    }

    if (!file?.buffer) {
      throw new InternalServerErrorException('File buffer is undefined');
    }

    const rootFolder = process.env.CLOUDINARY_ROOT_FOLDER || 'skygalaxy';
    const folder = `${rootFolder}/${modelName}`;
    const ext = path.extname(file.originalname).toLowerCase();
    const isPdf = ext === '.pdf';

    let bufferToUpload: Buffer = file.buffer;
    const resourceType: 'image' | 'raw' = isPdf ? 'raw' : 'image';
    const format = isPdf ? undefined : 'webp';

    if (!isPdf) {
      bufferToUpload = await this.optimizeImage(file.buffer, dimensions);
    }

    const timestamp = Date.now();
    const filename = `${file.fieldname}-${timestamp}-${uuidv4()}`;

    try {
      const uploadResult = await new Promise<UploadApiResponse>(
        (resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder,
              public_id: filename,
              resource_type: resourceType,
              format,
            },
            (error, result) => {
              if (error) {
                return reject(
                  new Error(error.message || 'Cloudinary upload stream failed'),
                );
              }
              if (!result) {
                return reject(
                  new Error('Cloudinary upload result is undefined'),
                );
              }
              resolve(result);
            },
          );
          uploadStream.end(bufferToUpload);
        },
      );

      return {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        provider: 'cloudinary',
      };
    } catch (error) {
      this.logger.error(
        `Cloudinary upload failed for ${file.originalname}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to upload file to Cloudinary',
      );
    }
  }

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

  async deleteFile(assetOrPath: FileAsset | string): Promise<void> {
    if (!this.ensureConfigured()) {
      this.logger.warn(
        'Cloudinary credentials missing, skipping cloud deletion',
      );
      return;
    }

    let publicId = '';
    let isPdf = false;

    if (typeof assetOrPath === 'string') {
      publicId = this.extractPublicId(assetOrPath);
      isPdf = assetOrPath.toLowerCase().includes('.pdf');
    } else {
      publicId = assetOrPath.publicId || this.extractPublicId(assetOrPath.url);
      isPdf = (assetOrPath.url || '').toLowerCase().includes('.pdf');
    }

    if (!publicId) return;

    try {
      const resourceType = isPdf ? 'raw' : 'image';
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });
    } catch (error) {
      this.logger.error(`Error deleting Cloudinary asset: ${publicId}`, error);
    }
  }

  async deleteFiles(assetsOrPaths: (FileAsset | string)[]): Promise<void> {
    if (!assetsOrPaths?.length) return;
    await Promise.all(assetsOrPaths.map((item) => this.deleteFile(item)));
  }

  private async optimizeImage(
    buffer: Buffer,
    dimensions?: { width: number; height: number },
  ): Promise<Buffer> {
    const { width, height } = dimensions || { width: 600, height: 600 };
    return sharp(buffer)
      .resize({
        width,
        height,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat('webp', {
        quality: parseInt(process.env.IMAGE_QUALITY || '80', 10),
      })
      .toBuffer();
  }

  private extractPublicId(urlOrId: string): string {
    if (!urlOrId) return '';
    if (!urlOrId.startsWith('http')) return urlOrId;

    // Pattern: /upload/(?:v\d+/)?(path/to/filename)(?:\.[^.]+)?$
    const regex = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/;
    const match = urlOrId.match(regex);
    return match ? match[1] : urlOrId;
  }
}
