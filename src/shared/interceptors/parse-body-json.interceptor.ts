import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Interceptor that runs BEFORE ValidationPipe on multipart/form-data requests.
 * - Parses specified fields from JSON strings to plain objects.
 * - Coerces specified fields to arrays (multer returns a string when only one value is sent).
 */
@Injectable()
export class ParseBodyJsonInterceptor implements NestInterceptor {
  private readonly jsonFields: string[];
  private readonly arrayFields: string[];

  constructor(jsonFields: string[] = [], arrayFields: string[] = []) {
    this.jsonFields = jsonFields;
    this.arrayFields = arrayFields;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ body: Record<string, unknown> }>();
    if (request.body) {
      // Parse JSON-string fields into plain objects
      for (const field of this.jsonFields) {
        const value = request.body[field];
        if (typeof value === 'string') {
          try {
            request.body[field] = JSON.parse(value) as unknown;
          } catch {
            // leave as-is if unparseable
          }
        }
      }

      // Coerce scalar values to arrays for fields that must be arrays
      for (const field of this.arrayFields) {
        const value = request.body[field];
        if (value === undefined || value === null) {
          request.body[field] = [];
        } else if (!Array.isArray(value)) {
          request.body[field] = [value];
        }
      }
    }

    return next.handle();
  }
}
