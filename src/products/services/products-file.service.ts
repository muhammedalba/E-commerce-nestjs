import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import {
  MulterFilesType,
  MulterFileType,
} from 'src/shared/utils/interfaces/fileInterface';

/**
 * Handles all file upload / delete operations for products.
 */
@Injectable()
export class ProductFileService {
  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly i18n: CustomI18nService,
  ) {}

  // ──────────────────────────────────────────────────────
  //  SINGLE FILE UPLOAD
  // ──────────────────────────────────────────────────────

  async uploadSingleFile(
    file: MulterFileType,
    folder: string,
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException(
        this.i18n.translate('exception.FILE_REQUIRED'),
      );
    }
    return this.fileUploadService.saveFileToDisk(file, folder);
  }

  // ──────────────────────────────────────────────────────
  //  MULTIPLE FILES UPLOAD
  // ──────────────────────────────────────────────────────

  async uploadMultipleFiles(
    files: MulterFilesType,
    folder: string,
  ): Promise<string[] | undefined> {
    if (!files || files.length === 0) return undefined;
    const fileArray = Array.isArray(files)
      ? files
      : Object.values(files).flat();
    return this.fileUploadService.saveFilesToDisk(fileArray, folder);
  }

  // ──────────────────────────────────────────────────────
  //  HANDLE FILES ON CREATE
  // ──────────────────────────────────────────────────────

  async handleCreateFiles(files: {
    imageCover: MulterFilesType;
    images?: MulterFilesType;
    infoProductPdf?: MulterFilesType;
  }): Promise<{
    imageCover?: string;
    images?: string[];
    infoProductPdf?: string;
  }> {
    const result: {
      imageCover?: string;
      images?: string[];
      infoProductPdf?: string;
    } = {};

    try {
      if (
        files.imageCover &&
        Array.isArray(files.imageCover) &&
        files.imageCover[0]
      ) {
        result.imageCover =
          (await this.uploadSingleFile(files.imageCover[0], 'products')) ?? '';
      }

      if (
        files.infoProductPdf &&
        Array.isArray(files.infoProductPdf) &&
        files.infoProductPdf[0]
      ) {
        result.infoProductPdf = await this.uploadSingleFile(
          files.infoProductPdf[0],
          'products',
        );
      }

      result.images = await this.uploadMultipleFiles(
        files.images,
        'products',
      );
    } catch {
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }

    return result;
  }

  // ──────────────────────────────────────────────────────
  //  HANDLE FILES ON UPDATE
  // ──────────────────────────────────────────────────────

  async handleUpdateFiles(
    doc: {
      imageCover?: string;
      infoProductPdf?: string;
      images?: string[];
    },
    files: {
      imageCover?: MulterFilesType;
      images?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
    },
    bodyImages?: string[] | string,
  ): Promise<
    Partial<{ imageCover: string; infoProductPdf: string; images: string[] }>
  > {
    const result: Partial<{
      imageCover: string;
      infoProductPdf: string;
      images: string[];
    }> = {};

    try {
      // 1. Handle single files (imageCover + infoProductPdf)
      const singleFiles: Record<string, MulterFilesType | undefined> = {
        imageCover: files.imageCover,
        infoProductPdf: files.infoProductPdf,
      };

      for (const [key, file] of Object.entries(singleFiles)) {
        if (file && Array.isArray(file) && file[0]) {
          const newPath = await this.fileUploadService.saveFileToDisk(
            file[0] as MulterFileType,
            'products',
          );
          if (key === 'imageCover' || key === 'infoProductPdf') {
            const oldPath = doc[key as 'imageCover' | 'infoProductPdf'];
            if (oldPath) {
              await this.fileUploadService.deleteFile(`.${oldPath}`);
            }
          }
          (result as any)[key] = newPath;
        }
      }

      // 2. Parse remaining images from body
      let remainingImages: string[] = [];
      if (bodyImages) {
        remainingImages = Array.isArray(bodyImages)
          ? bodyImages.filter((img) => typeof img === 'string')
          : [bodyImages];
      }

      // 3. Delete images that are no longer referenced
      const normalize = (url: string) => {
        try {
          return new URL(url.trim().toLowerCase()).pathname;
        } catch {
          return url.trim().toLowerCase();
        }
      };

      const remainingSet = new Set(remainingImages.map(normalize));

      if (doc.images) {
        const imagesToDelete = doc.images.filter(
          (img) => !remainingSet.has(normalize(img)),
        );
        if (imagesToDelete.length > 0) {
          await this.fileUploadService.deleteFiles(imagesToDelete);
        }
      }

      // 4. Upload new images
      let newImages: string[] = [];
      if (
        files.images &&
        Array.isArray(files.images) &&
        files.images.length > 0
      ) {
        newImages = await this.fileUploadService.saveFilesToDisk(
          files.images,
          'products',
        );
      }

      // 5. Merge final images (remaining old + new)
      const remainingArray = Array.from(remainingSet);
      result.images = [...remainingArray, ...newImages];
    } catch {
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }

    return result;
  }

  // ──────────────────────────────────────────────────────
  //  DELETE ALL PRODUCT FILES
  // ──────────────────────────────────────────────────────

  async deleteProductFiles(doc: {
    imageCover?: string;
    infoProductPdf?: string;
    images?: string[];
  }): Promise<void> {
    if (doc.imageCover) {
      await this.fileUploadService.deleteFile(`.${doc.imageCover}`);
    }
    if (doc.infoProductPdf) {
      await this.fileUploadService.deleteFile(`.${doc.infoProductPdf}`);
    }
    if (doc.images && Array.isArray(doc.images)) {
      await this.fileUploadService.deleteFiles(doc.images);
    }
  }
}
