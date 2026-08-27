import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import {
  MulterFilesType,
  MulterFileType,
} from 'src/shared/utils/interfaces/fileInterface';
import { Product } from '../shared/schemas/Product.schema';
import { FileAsset } from 'src/shared/schema/file-asset.schema';

/**
 * Handles all file upload / delete operations for products.
 */
@Injectable()
export class ProductFileService {
  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly i18n: CustomI18nService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  //  SINGLE FILE UPLOAD
  // ─────────────────────────────────────────────────────────────

  async uploadSingleFile(
    file: MulterFileType,
    folder: string,
  ): Promise<FileAsset> {
    if (!file) {
      throw new BadRequestException(
        this.i18n.translate('exception.FILE_REQUIRED'),
      );
    }
    return this.fileUploadService.saveFileToDisk(file, folder);
  }

  // ─────────────────────────────────────────────────────────────
  //  MULTIPLE FILES UPLOAD
  // ─────────────────────────────────────────────────────────────

  async uploadMultipleFiles(
    files: MulterFilesType,
    folder: string,
  ): Promise<FileAsset[] | undefined> {
    if (!files || files.length === 0) return undefined;
    const fileArray = Array.isArray(files)
      ? files
      : Object.values(files).flat();
    return this.fileUploadService.saveFilesToDisk(fileArray, folder);
  }

  // ─────────────────────────────────────────────────────────────
  //  HANDLE FILES ON CREATE
  // ─────────────────────────────────────────────────────────────

  async handleCreateFiles(files: {
    imageCover: MulterFilesType;
    images?: MulterFilesType;
    infoProductPdf?: MulterFilesType;
  }): Promise<{
    imageCover?: FileAsset;
    images?: FileAsset[];
    infoProductPdf?: FileAsset;
  }> {
    const result: {
      imageCover?: FileAsset;
      images?: FileAsset[];
      infoProductPdf?: FileAsset;
    } = {};

    try {
      if (
        files.imageCover &&
        Array.isArray(files.imageCover) &&
        files.imageCover[0]
      ) {
        result.imageCover = await this.uploadSingleFile(
          files.imageCover[0],
          Product.name,
        );
      }

      if (
        files.infoProductPdf &&
        Array.isArray(files.infoProductPdf) &&
        files.infoProductPdf[0]
      ) {
        result.infoProductPdf = await this.uploadSingleFile(
          files.infoProductPdf[0],
          Product.name,
        );
      }

      result.images = await this.uploadMultipleFiles(
        files.images,
        Product.name,
      );
    } catch {
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────
  //  HANDLE FILES ON UPDATE
  // ─────────────────────────────────────────────────────────────

  async handleUpdateFiles(
    doc: {
      imageCover?: FileAsset | string;
      infoProductPdf?: FileAsset | string;
      images?: (FileAsset | string)[];
    },
    files: {
      imageCover?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
      images?: MulterFilesType;
    },
    bodyImages?: (FileAsset | string)[] | FileAsset | string,
  ): Promise<{
    updates: Partial<{
      imageCover: FileAsset;
      infoProductPdf: FileAsset;
      images: (FileAsset | string)[];
    }>;
    filesToDelete: (FileAsset | string)[];
  }> {
    const result: Partial<{
      imageCover: FileAsset;
      infoProductPdf: FileAsset;
      images: (FileAsset | string)[];
    }> = {};
    const filesToDelete: (FileAsset | string)[] = [];

    try {
      // 1. Handle single files (imageCover + infoProductPdf)
      const singleFiles: Record<string, MulterFilesType | undefined> = {
        imageCover: files.imageCover,
        infoProductPdf: files.infoProductPdf,
      };

      for (const [key, file] of Object.entries(singleFiles)) {
        if (file && Array.isArray(file) && file[0]) {
          const newAsset = await this.fileUploadService.saveFileToDisk(
            file[0] as MulterFileType,
            Product.name,
          );
          if (key === 'imageCover' || key === 'infoProductPdf') {
            const oldAsset = doc[key];
            if (oldAsset) {
              filesToDelete.push(oldAsset);
            }
            result[key] = newAsset;
          }
        }
      }

      // 2. Parse remaining images from body
      let remainingImages: (FileAsset | string)[] = [];
      if (bodyImages) {
        const rawRemaining = Array.isArray(bodyImages)
          ? bodyImages
          : [bodyImages];
        remainingImages = rawRemaining.map((item) => {
          if (typeof item === 'string') {
            try {
              return JSON.parse(item) as FileAsset;
            } catch {
              return item;
            }
          }
          return item;
        });
      }

      // 3. Delete images that are no longer referenced
      const getNormalizedUrl = (item: FileAsset | string): string => {
        const raw = typeof item === 'string' ? item : item.url || '';
        try {
          return new URL(raw.trim().toLowerCase()).pathname;
        } catch {
          return raw.trim().toLowerCase();
        }
      };

      const remainingUrlSet = new Set(
        remainingImages.map(getNormalizedUrl).filter(Boolean),
      );

      if (doc.images && Array.isArray(doc.images)) {
        const imagesToDelete = doc.images.filter(
          (img) => !remainingUrlSet.has(getNormalizedUrl(img)),
        );
        if (imagesToDelete.length > 0) {
          filesToDelete.push(...imagesToDelete);
        }
      }

      // 4. Upload new images
      let newImages: FileAsset[] = [];
      if (
        files.images &&
        Array.isArray(files.images) &&
        files.images.length > 0
      ) {
        newImages = await this.fileUploadService.saveFilesToDisk(
          files.images,
          Product.name,
        );
      }

      // 5. Merge final images (remaining old + new)
      result.images = [...remainingImages, ...newImages];
    } catch {
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }

    return { updates: result, filesToDelete };
  }

  // ─────────────────────────────────────────────────────────────
  //  DELETE ALL PRODUCT FILES
  // ─────────────────────────────────────────────────────────────

  async deleteProductFiles(doc: {
    imageCover?: FileAsset | string;
    infoProductPdf?: FileAsset | string;
    images?: (FileAsset | string)[];
  }): Promise<void> {
    if (doc.imageCover) {
      await this.fileUploadService.deleteFile(doc.imageCover);
    }
    if (doc.infoProductPdf) {
      await this.fileUploadService.deleteFile(doc.infoProductPdf);
    }
    if (doc.images && Array.isArray(doc.images)) {
      await this.fileUploadService.deleteFiles(doc.images);
    }
  }

  async deleteFilesList(files: (FileAsset | string)[]): Promise<void> {
    if (!files || files.length === 0) return;
    await this.fileUploadService.deleteFiles(files);
  }
}
