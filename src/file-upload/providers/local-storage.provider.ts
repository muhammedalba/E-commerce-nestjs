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

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  readonly providerType: StorageProviderType = 'local';
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly IMAGE_FORMAT = process.env.IMAGE_FORMAT || 'webp';
  private readonly IMAGE_QUALITY = parseInt(
    process.env.IMAGE_QUALITY || '80',
    10,
  );

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

  async deleteFiles(assetsOrPaths: (FileAsset | string)[]): Promise<void> {
    if (!assetsOrPaths?.length) return;
    await Promise.all(assetsOrPaths.map((item) => this.deleteFile(item)));
  }

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
