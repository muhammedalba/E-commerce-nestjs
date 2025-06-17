
import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ParseJsonPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      throw new BadRequestException(
        `${metadata.data} must be a valid JSON string`,
      );
    }
  }
}
