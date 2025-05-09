import {
  FileTypeValidator,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FileSignatureValidator } from './validators/file-signature.validator';
import { FileValidator } from '@nestjs/common/pipes/file/file-validator.interface';
import { FileSizeType, FileType } from './types/file.types';
import { createFileTypeRegex } from './utils/file.util';
import { NonEmptyArray } from '../utils/array.util';
import * as bytes from 'bytes';

const createFileValidators = (
  maxSize: FileSizeType,
  fileTypes: NonEmptyArray<FileType>,
): FileValidator[] => {
  const fileTypeRegex = createFileTypeRegex(fileTypes);

  return [
    new MaxFileSizeValidator({
      maxSize: bytes(maxSize) || 0,
      message: (maxSize) =>
        `File is too big. Max file size is ${maxSize} bytes`,
    }),
    new FileTypeValidator({
      fileType: fileTypeRegex,
    }),
    new FileSignatureValidator(),
  ];
};

export const createParseFilePipe = (
  maxSize: FileSizeType,
  fileTypes: NonEmptyArray<FileType>,
  IsRequired?: boolean,
): ParseFilePipe =>
  new ParseFilePipe({
    validators: createFileValidators(maxSize, fileTypes),
    errorHttpStatusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    exceptionFactory: (error: string) => {
      throw new UnprocessableEntityException(error);
    },
    fileIsRequired: IsRequired ? true : false,
  });
