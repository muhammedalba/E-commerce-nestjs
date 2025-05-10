import {
  Injectable,
  PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { FileSignatureValidator } from './validators/file-signature.validator';
import { FileValidator } from '@nestjs/common/pipes/file/file-validator.interface';
import { createFileTypeRegex } from './utils/file.util';
import { FileSizeType, FileType } from './types/file.types';
import * as bytes from 'bytes';

interface FileFieldConfig {
  name: string;
  required?: boolean;
}

@Injectable()
export class ParseFileFieldsPipe implements PipeTransform {
  constructor(
    private maxSize: FileSizeType,
    private fileTypes: FileType[],
    private fieldConfigs: FileFieldConfig[], // <-- كل حقل مع تحديد إذا كان مطلوبًا
  ) {}

  private createValidators(): FileValidator[] {
    const fileTypeRegex = createFileTypeRegex(this.fileTypes);
    return [
      new MaxFileSizeValidator({
        maxSize: bytes(this.maxSize) || 0,
        message: (size) => `File too big. Max size is ${size} bytes.`,
      }),
      new FileTypeValidator({ fileType: fileTypeRegex }),
      new FileSignatureValidator(),
    ];
  }

  async transform(files: Record<string, Express.Multer.File[]>) {
    if (!files || typeof files !== 'object') {
      files = {}; // نعاملها كـ كائن فارغ لتفادي الخطأ
    }

    const validators = this.createValidators();

    for (const config of this.fieldConfigs) {
      const fileArray = files[config.name];

      if (!fileArray || fileArray.length === 0) {
        if (config.required) {
          throw new UnprocessableEntityException(
            `File field '${config.name}' is required`,
          );
        }
        continue;
      }

      for (const file of fileArray) {
        for (const validator of validators) {
          const isValid = await validator.isValid(file);
          if (!isValid) {
            const message = `File validation failed.`;

            throw new UnprocessableEntityException(message);
          }
        }
      }
    }

    return files;
  }
}
