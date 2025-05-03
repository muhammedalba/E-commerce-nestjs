import { FileValidator } from '@nestjs/common/pipes/file/file-validator.interface';
import filetype from 'magic-bytes.js';

export class FileSignatureValidator extends FileValidator {
  constructor() {
    super({});
  }
  isValid(file): any {
    const files_signatures = filetype(file.buffer).map((type) => type.mime);
    if (!files_signatures.length) return false;
    const isMatch = files_signatures.includes(file.mimetype);
    if (!isMatch) return false;
    return true;
  }
  buildErrorMessage(file: any): string {
    return `validation failed (file type not supported)${file}`;
  }
}
