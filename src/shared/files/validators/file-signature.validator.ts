import { FileValidator } from '@nestjs/common/pipes/file/file-validator.interface';
import filetype from 'magic-bytes.js';

export class FileSignatureValidator extends FileValidator {
  constructor() {
    super({});
  }
  isValid(file): any {
    const files_signatures = filetype(file.buffer).map((type) => type.mime);
    if (!files_signatures.length) {
      console.log(`[FileSignatureValidator] No signatures found for ${file.originalname}`);
      return false;
    }
    const isMatch = files_signatures.includes(file.mimetype);
    if (!isMatch) {
      console.log(`[FileSignatureValidator] Mismatch for ${file.originalname}: detected ${files_signatures.join(', ')} but expected ${file.mimetype}`);
      return false;
    }
    return true;
  }
  buildErrorMessage(file: any): string {
    return `validation failed (file type not supported)${file}`;
  }
}
