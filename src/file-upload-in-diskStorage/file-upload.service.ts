import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { extname } from 'path';
import * as fs from 'fs';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { Request } from 'express';

interface FileSchema {
  avatar?: string;
  image?: string;
  imageCover?: string;
  infoProductPdf?: string;
  carouselSm?: string;
  carouselMd?: string;
  carouselLg?: string;
  transferReceiptImg?: string;
  InvoicePdf?: string;
}
type fileType = Request['file'];
type filesType = Request['files'];
@Injectable()
export class FileUploadService {
  async saveFileToDisk(
    file: MulterFileType,
    modelName: string,
  ): Promise<string> {
    // 1) check file if it not exists
    if (!file?.buffer) {
      return '';
    }

    // 2) if exists
    try {
      const uploadsDir = process.env.UPLOADS_DIRECTORY || 'uploads';
      // 1) add path to the file
      const destinationPath = `./${uploadsDir}/${modelName}`;
      // 1) generate a unique filename
      const timestamp = Date.now();
      const ext = extname(file.originalname);
      const safeExt = ext.length > 0 ? ext : '.png';
      const filename = `${file.fieldname}-${timestamp}-${uuidv4()}${safeExt}`;
      const outputPath = `${destinationPath}/${filename}`;
      // const outputPath = `${destinationPath}/${filename}`;
      //2) Check if the destination directory exists, and create it if not.
      await fs.promises.mkdir(destinationPath, { recursive: true });
      if (ext === '.pdf') {
        // const filePath = path.join(uploadsDir, `${outputPath}`);

        // Save the PDF file directly
        fs.writeFileSync(outputPath, file.buffer);
        // await writeFile(outputPath, file.buffer);
        const file_path = outputPath.startsWith('.')
          ? outputPath.slice(1)
          : outputPath;
        return file_path;
      }

      //3) resize the image and save it to disk
      await this.processAndSaveImage(file, outputPath);
      // await writeFile(outputPath, file.buffer);
      const file_path = outputPath.startsWith('.')
        ? outputPath.slice(1)
        : outputPath;
      return file_path;
    } catch (error) {
      console.error('Error saving file to disk:', error);
      throw new InternalServerErrorException('Failed to save file to disk');
    }
  }
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
      console.error('Error saving files to disk:', error);
      throw new InternalServerErrorException('Failed to save files to disk');
    }
  }
  async updateFile(
    file: MulterFileType,
    modelName: string,
    doc: FileSchema,
    old_Path?: string,
  ) {
    // 1) add path to the file
    const destinationPath = `./${process.env.UPLOADS_FOLDER}/${modelName}`;
    // 2) check if file exists
    let old_File_Path: string | null;
    const imagePath =
      old_Path ||
      doc.avatar ||
      doc.transferReceiptImg ||
      doc.InvoicePdf ||
      doc.infoProductPdf ||
      doc.imageCover ||
      doc.image ||
      doc.carouselSm ||
      doc.carouselMd ||
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
      console.error(`Error updating file ${destinationPath}:`, error);
    }
  }
  async deleteFiles(filePaths: string[]): Promise<[]> {
    await Promise.all(
      filePaths.map((filePath) => this.deleteFile(`./${filePath}`)),
    );
    return [];
  }
  async deleteFile(Path: string): Promise<void> {
    if (!Path) {
      console.warn('No path provided for file deletion.');
      return;
    }
    // delete avatar file from disk, but not if it's the default avatar image path.
    if (Path.includes('default.png') || Path.includes('avatar.png')) {
      return;
    }
    // Check if file exists before trying to delete it.
    try {
      await fs.promises.access(Path);
      await fs.promises.unlink(Path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Error deleting file ${Path}:`, error);
      }
      // }
    }
  }

  //
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
        .toFormat('webp')
        .webp({ quality: 80 })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error('❌ Error resizing image:', error);
      throw new InternalServerErrorException('Failed to resize image');
    }
  }
}
