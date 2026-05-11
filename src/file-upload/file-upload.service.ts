import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { Request } from 'express';
import * as path from 'path';

type filesType = Request['files'];

// استخدام Record لتعريف الأبعاد لتنظيف الكود والتخلص من الـ Switch
const IMAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  image: { width: 600, height: 600 },
  avatar: { width: 200, height: 200 },
  carouselSm: { width: 480, height: 240 },
  carouselMd: { width: 800, height: 400 },
  carouselLg: { width: 1200, height: 600 },
  transferReceiptImg: { width: 1200, height: 1024 },
  logo: { width: 500, height: 300 },
  favicon: { width: 64, height: 64 },
};

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly IMAGE_FORMAT = process.env.IMAGE_FORMAT || 'webp';
  private readonly IMAGE_QUALITY = parseInt(process.env.IMAGE_QUALITY || '80');

  // ===========================================================
  // =============  SAVE IMAGE PDF OR FILE TO DISK =============
  // ===========================================================
  async saveFileToDisk(file: MulterFileType, modelName: string): Promise<string> {
    if (!file?.buffer) return '';

    try {
      const uploadsDir = process.env.UPLOADS_FOLDER || 'uploads';
      const destinationPath = path.join(process.cwd(), uploadsDir, modelName);

      const timestamp = Date.now();
      const ext = path.extname(file.originalname).toLowerCase();
      const finalExt = ext === '.pdf' ? '.pdf' : `.${this.IMAGE_FORMAT}`;
      const filename = `${file.fieldname}-${timestamp}-${uuidv4()}${finalExt}`;
      const outputPath = path.join(destinationPath, filename);

      await fs.mkdir(destinationPath, { recursive: true });

      if (ext === '.pdf') {
        await fs.writeFile(outputPath, file.buffer);
      } else {
        await this.processAndSaveImage(file, outputPath);
      }

      return path.posix.join('/', uploadsDir, modelName, filename);
    } catch (error) {
      this.logger.error(`Error saving file ${file.originalname} to disk`, error);
      throw new InternalServerErrorException('Failed to save file to disk');
    }
  }

  // ===========================================================
  // =============  SAVE IMAGES TO DISK =============
  // ===========================================================
  async saveFilesToDisk(files: filesType, destinationPath: string): Promise<string[]> {
    if (!files?.length) return [];

    try {
      return await Promise.all(
        (files as MulterFileType[]).map((file) =>
          this.saveFileToDisk(file, destinationPath),
        ),
      );
    } catch (error) {
      this.logger.error('Error saving files to disk', error);
      throw new InternalServerErrorException('Failed to save files to disk');
    }
  }

  // ===========================================================
  // =============  UPDATE FILE TO DISK =============
  // ===========================================================
  async updateFile(
    file: MulterFileType,
    modelName: string,
    doc: any, // بقيناها حتى لا ينكسر الكود القديم في ملفات أخرى
    oldPath?: string,
  ): Promise<string | undefined> {
    try {
      // 1. رفع الملف الجديد
      const newFilePath = await this.saveFileToDisk(file, modelName);

      // 2. حذف الملف القديم باستخدام مساره الدقيق (الآن أصبح آمناً جداً)
      if (oldPath) {
        await this.deleteFile(oldPath);
      }

      return newFilePath;
    } catch (error) {
      this.logger.error(`Error updating file for model ${modelName}`, error);
      throw new InternalServerErrorException('Failed to update file');
    }
  }

  // ===========================================================
  // =============  DELETE FILES TO DISK =============
  // ===========================================================
  async deleteFiles(filePaths: string[]): Promise<[]> {
    await Promise.all(
      filePaths.map((filePath) => this.deleteFile(filePath)),
    );
    return [];
  }

  // ===========================================================
  // =============  DELETE FILE TO DISK =============
  // ===========================================================
  async deleteFile(filePath: string): Promise<void> {
    if (!filePath) {
      this.logger.warn('No path provided for file deletion.');
      return;
    }

    if (filePath.includes('default.png') || filePath.includes('avatar.png')) {
      return;
    }

    try {
      let cleanShortPath = filePath;

      if (filePath.startsWith('http')) {
        cleanShortPath = new URL(filePath).pathname;
      } else {
        const baseUrl = process.env.BASE_URL || "http://localhost:4000";
        cleanShortPath = filePath.replace(baseUrl, '');
      }

      const absolutePath = path.join(process.cwd(), cleanShortPath);

      await fs.access(absolutePath);
      await fs.unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Error deleting file ${filePath}`, error);
      }
    }
  }

  // ===========================================================
  // =============  PROCESS AND SAVE IMAGE TO DISK =============
  // ===========================================================
  async processAndSaveImage(file: MulterFileType, outputPath: string): Promise<string> {
    if (!file?.buffer) {
      throw new InternalServerErrorException('File buffer is undefined');
    }

    // الاعتماد على كائن الأبعاد بدلاً من الـ Switch
    const defaultDimensions = { width: 500, height: 500 };
    const { width, height } = IMAGE_DIMENSIONS[file.fieldname] || defaultDimensions;

    try {
      await sharp(file.buffer)
        .resize({
          width,
          height,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toFormat(this.IMAGE_FORMAT as keyof sharp.FormatEnum, { 
          quality: this.IMAGE_QUALITY 
        })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      this.logger.error('Error resizing image', error);
      throw new InternalServerErrorException('Failed to resize image');
    }
  }
}