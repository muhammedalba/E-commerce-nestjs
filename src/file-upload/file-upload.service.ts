import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { extname } from 'path';
import * as fs from 'fs';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { Request } from 'express';
import * as path from 'path'; //

interface FileSchema {
  avatar?: string;
  image?: string;
  imageCover?: string;
  infoProductPdf?: string;
  carouselSm?: string;
  carouselMd?: string;
  carouselLg?: string;
  logo?: string | null;
  favicon?: string | null;
  transferReceiptImg?: string;
  InvoicePdf?: string;
}
type fileType = Request['file'];
type filesType = Request['files'];
@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly IMAGE_FORMAT = process.env.IMAGE_FORMAT || 'webp';
  private readonly IMAGE_QUALITY = parseInt(process.env.IMAGE_QUALITY || '80');



  // ===========================================================
  // =============  SAVE IMAGE PDF OR FILE TO DISK =============
  // ===========================================================

  // async saveFileToDisk(
  //   file: MulterFileType,
  //   modelName: string,
  // ): Promise<string> {
  //   // 1) check file if it not exists
  //   if (!file?.buffer) {
  //     return '';
  //   }

  //   // 2) if exists
  //   try {
  //     const uploadsDir = process.env.UPLOADS_FOLDER || 'uploads';
  //     // 1) add path to the file
  //     const destinationPath = `./${uploadsDir}/${modelName}`;
  //     // 1) generate a unique filename
  //     const timestamp = Date.now();
  //     const ext = extname(file.originalname).toLowerCase();
  //     // Use the centralized format for images, keep .pdf as is
  //     const finalExt = ext === '.pdf' ? '.pdf' : `.${this.IMAGE_FORMAT}`;
  //     const filename = `${file.fieldname}-${timestamp}-${uuidv4()}${finalExt}`;
  //     const outputPath = `${destinationPath}/${filename}`;
  //     //2) Check if the destination directory exists, and create it if not.
  //     await fs.promises.mkdir(destinationPath, { recursive: true });
  //     if (ext === '.pdf') {
  //       // const filePath = path.join(uploadsDir, `${outputPath}`);

  //       // Save the PDF file directly
  //       fs.writeFileSync(outputPath, file.buffer);
  //       // await writeFile(outputPath, file.buffer);
  //       const file_path = outputPath.startsWith('.')
  //         ? outputPath.slice(1)
  //         : outputPath;
  //       return file_path;
  //     }

  //     //3) resize the image and save it to disk


  //     await this.processAndSaveImage(file, outputPath);
  //     // await writeFile(outputPath, file.buffer);
  //     const file_path = outputPath.startsWith('.')
  //       ? outputPath.slice(1)
  //       : outputPath;
  //     return file_path;
  //   } catch (error) {
  //     this.logger.error('Error saving file to disk', error);
  //     throw new InternalServerErrorException('Failed to save file to disk');
  //   }
  // }


  // ... (داخل الكلاس الخاص بك)

  async saveFileToDisk(file: MulterFileType, modelName: string): Promise<string> {
    // 1) التحقق من وجود بيانات الملف
    if (!file?.buffer) {
      return '';
    }

    try {
      const uploadsDir = process.env.UPLOADS_FOLDER || 'uploads';

      // بناء المسار المطلق بشكل آمن متوافق مع كافة أنظمة التشغيل
      const destinationPath = path.join(process.cwd(), uploadsDir, modelName);

      // إنشاء اسم الملف
      const timestamp = Date.now();
      const ext = path.extname(file.originalname).toLowerCase();
      const finalExt = ext === '.pdf' ? '.pdf' : `.${this.IMAGE_FORMAT}`;
      const filename = `${file.fieldname}-${timestamp}-${uuidv4()}${finalExt}`;

      // المسار النهائي الذي سيتم حفظ الملف فيه
      const outputPath = path.join(destinationPath, filename);

      // 2) إنشاء المجلد إن لم يكن موجوداً
      await fs.promises.mkdir(destinationPath, { recursive: true });

      // 3) معالجة الملف وحفظه (بدون حظر الـ Event Loop)
      if (ext === '.pdf') {
        // ✅ تم استخدام writeFile بدلاً من writeFileSync
        await fs.promises.writeFile(outputPath, file.buffer);
      } else {
        // معالجة الصور
        await this.processAndSaveImage(file, outputPath);
      }

      // 4) تجهيز المسار العام (Public Path) للإرجاع
      // استخدمنا path.posix.join لضمان أن الرابط يستخدم '/' دائماً (حتى في ويندوز) للروابط
      const publicPath = path.posix.join('/', uploadsDir, modelName, filename);

      return publicPath; // النتيجة: /uploads/ModelName/filename.pdf

    } catch (error) {
      this.logger.error(`Error saving file ${file.originalname} to disk`, error);
      throw new InternalServerErrorException('Failed to save file to disk');
    }
  }
  // ===========================================================
  // =============  SAVE IMAGES TO DISK =============
  // ===========================================================
  async saveFilesToDisk(
    files: filesType,
    destinationPath: string,
  ): Promise<string[]> {
    if (!files?.length) {
      return [];
    }

    try {
      const filePaths = await Promise.all(
        (files as MulterFileType[]).map((file) =>
          this.saveFileToDisk(file, destinationPath),
        ),
      );
      return filePaths;
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
    doc: FileSchema,
    old_Path?: string,
  ) {
    // 1) add path to the file
    const uploadsDir = process.env.UPLOADS_FOLDER || 'uploads';
    const destinationPath = `./${uploadsDir}/${modelName}`;
    // 2) check if file exists
    let old_File_Path: string | null;
    const imagePath =
      old_Path ||
      doc.avatar ||
      doc.infoProductPdf ||
      doc.imageCover ||
      doc.image ||
      doc.transferReceiptImg ||
      doc.InvoicePdf ||
      doc.carouselSm ||
      doc.carouselMd ||
      doc.logo ||
      doc.favicon ||
      doc.carouselLg;

    if (doc && imagePath) {
      old_File_Path = `.${imagePath}`;
    } else {
      old_File_Path = null;
    }
    try {
      const file_path = await this.saveFileToDisk(file, modelName);
      // Check if file exists before trying to update it.
      if (old_File_Path) {
        await this.deleteFile(old_File_Path);
      }
      return file_path;
    } catch (error) {
      this.logger.error(`Error updating file ${destinationPath}`, error);
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
    // 1. التحقق من وجود مسار
    if (!filePath) {
      this.logger.warn('No path provided for file deletion.');
      return;
    }

    // 2. حماية الصور الافتراضية
    if (filePath.includes('default.png') || filePath.includes('avatar.png')) {
      return;
    }

    try {
      let cleanShortPath = filePath;

      // 3. تنظيف الرابط بشكل احترافي
      // إذا كان المسار يبدأ بـ http، نستخرج منه المسار فقط بأمان
      if (filePath.startsWith('http')) {
        cleanShortPath = new URL(filePath).pathname;
      } else {
        // كإجراء احتياطي إذا لم يبدأ بـ http
        const baseUrl = process.env.BASE_URL || "http://localhost:4000";
        cleanShortPath = filePath.replace(baseUrl, '');
      }

      // 4. بناء المسار المطلق (Absolute Path) بأمان باستخدام path.join
      // process.cwd() يضمن لك دائماً البدء من المجلد الجذري للمشروع
      const absolutePath = path.join(process.cwd(), cleanShortPath);

      // 5. التحقق من الملف وحذفه
      await fs.promises.access(absolutePath);
      await fs.promises.unlink(absolutePath);

    } catch (error) {
      // تجاهل خطأ "الملف غير موجود" فقط
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Error deleting file ${filePath}`, error);
      }
    }
  }
  // ===========================================================
  // =============  PROCESS AND SAVE IMAGE TO DISK =============
  // ===========================================================
  async processAndSaveImage(file: fileType, outputPath: string) {
    let width = 500;
    let height = 500;

    if (!file) {
      throw new InternalServerErrorException('File is undefined');
    }
    switch (file.fieldname) {
      case 'image':
        width = 600;
        height = 600;
        break;
      case 'avatar':
        width = 200;
        height = 200;
        break;
      case 'carouselSm':
        width = 480;
        height = 240;
        break;
      case 'carouselMd':
        width = 800;
        height = 400;
        break;
      case 'carouselLg':
        width = 1200;
        height = 600;
        break;
      case 'transferReceiptImg':
        width = 1200;
        height = 1024;
        break;
      case 'logo':
        width = 500;
        height = 300;
        break;
      case 'favicon':
        width = 64;
        height = 64;
        break;
    }

    try {
      if (!file?.buffer) {
        throw new InternalServerErrorException('File buffer is undefined');
      }

      await sharp(file.buffer)
        .resize({
          width,
          height,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toFormat(this.IMAGE_FORMAT as any, { quality: this.IMAGE_QUALITY })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      this.logger.error('Error resizing image', error);
      throw new InternalServerErrorException('Failed to resize image');
    }
  }
}
