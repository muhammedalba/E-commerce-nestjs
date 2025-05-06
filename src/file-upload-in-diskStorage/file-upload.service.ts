import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { extname } from 'path';
import * as fs from 'fs';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { MulterFile } from 'src/shared/utils/interfaces/fileInterface';

interface FileSchema {
  avatar?: string;
  image?: string;
}
@Injectable()
export class FileUploadService {
  async saveFileToDisk(file: MulterFile, modelName: string): Promise<string> {
    // 1) check file if it not exists
    if (!file?.buffer) {
      return '';
    }
    // 2) if exists
    try {
      // 1) add path to the file
      const destinationPath = `./${process.env.UPLOADS_FOLDER}/${modelName}`;
      // 1) generate a unique filename
      const timestamp = Date.now();
      const ext = extname(file.originalname);
      const safeExt = ext.length > 0 ? ext : '.png';
      const filename = `${file.fieldname}-${timestamp}-${uuidv4()}${safeExt}`;
      const outputPath = `${destinationPath}/${filename}`;
      // const outputPath = `${destinationPath}/${filename}`;
      //2) Check if the destination directory exists, and create it if not.
      await fs.promises.mkdir(destinationPath, { recursive: true });
      //3) save image file in the destination directory
      await sharp(file.buffer)
        .resize(800, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 70 })
        .toFile(outputPath);
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
    files: Express.Multer.File[],
    destinationPath: string,
  ): Promise<string[]> {
    // if (!files.length) {
    //   return [];
    // }
    try {
      const filePaths = await Promise.all(
        files.map((file) => this.saveFileToDisk(file, destinationPath)),
      );
      console.log(`All files saved successfully to ${destinationPath}`);
      return filePaths;
    } catch (error) {
      console.error('Error saving files to disk:', error);
      throw new InternalServerErrorException('Failed to save files to disk');
    }
  }
  async updateFile(file: MulterFile, modelName: string, doc: FileSchema) {
    // 1) add path to the file
    const destinationPath = `./${process.env.UPLOADS_FOLDER}/${modelName}`;
    // 2) check if file exists
    let old_File_Path: string | null;
    if (doc && doc.avatar) {
      old_File_Path = `.${doc.avatar}`;
    } else if (doc.image) {
      old_File_Path = `.${doc.image}`;
    } else {
      old_File_Path = null;
    }

    try {
      const file_path = await this.saveFileToDisk(file, destinationPath);
      // Check if file exists before trying to update it.
      if (old_File_Path && fs.existsSync(old_File_Path)) {
        await this.deleteFile(old_File_Path);
      }
      return file_path;
    } catch (error) {
      console.error(`Error updating file ${destinationPath}:`, error);
    }
  }
  async deleteFiles(filePaths: string[]): Promise<[]> {
    await Promise.all(filePaths.map((filePath) => this.deleteFile(filePath)));
    return [];
  }
  async deleteFile(Path: string): Promise<void> {
    const default_avatar_image: string = './uploads/users/avatar.png';
    // delete avatar file from disk, but not if it's the default avatar image path.
    if (default_avatar_image !== Path) {
      // Check if file exists before trying to delete it.
      // if (fs.existsSync(Path)) {
      try {
        await fs.promises.access(Path); // يتحقق من وجود الملف
        await fs.promises.unlink(Path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error(`Error deleting file ${Path}:`, error);
        }
        // }
      }
    }
  }
}
