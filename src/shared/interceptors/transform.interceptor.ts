import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Request, Response } from 'express';

interface PaginatedData<T> {
  results: number;
  pagination: any;
  data: T[];
}

interface MetaData {
  total?: number;
  pagination?: any;
  [key: string]: any;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  constructor(private readonly i18n: I18nService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((res: unknown) => {
        // Prepare shared base
        const baseResponse: Partial<ApiResponse<T>> = {
          success: true,
          statusCode,
          timestamp: new Date().toISOString(),
          path: request.url,
        };

        // 1. Handle legacy or already structured responses from BaseService
        let data = res;
        let messageKey: string | undefined;
        let meta: MetaData | undefined = undefined;

        if (res && typeof res === 'object' && !Array.isArray(res)) {
          const resultObj = res as Record<string, unknown>;

          // If it's a paginated result from BaseService
          if (
            resultObj.results !== undefined ||
            resultObj.pagination !== undefined
          ) {
            const paginated = res as PaginatedData<T>;
            data = paginated.data;
            meta = {
              total: paginated.results,
              pagination: paginated.pagination,
            };
          } else if (
            resultObj.data !== undefined &&
            resultObj.status === 'success'
          ) {
            // If it's a single result from BaseService (create/update/findOne)
            data = resultObj.data as T;
            messageKey = resultObj.message as string;
          }
        }

        // 2. Determine default message key based on HTTP method
        if (!messageKey) {
          const method = request.method;
          switch (method) {
            case 'POST':
              messageKey = 'success.created_SUCCESS';
              break;
            case 'PATCH':
              messageKey = 'success.updated_SUCCESS';
              break;
            case 'PUT':
              messageKey = 'success.updated_SUCCESS';
              break;
            case 'GET':
              messageKey = 'success.found_SUCCESS';
              break;
            case 'DELETE':
              messageKey = 'success.deleted_SUCCESS';
              break;
          }
        }

        // 3. Translate the message
        const lang = I18nContext.current()?.lang;
        const translatedMessage = messageKey
          ? this.i18n.translate(messageKey, { lang })
          : undefined;

        const finalMessage =
          typeof translatedMessage === 'string'
            ? translatedMessage
            : messageKey;

        // 4. Capture access_token if present in resultObj
        let access_token: string | undefined = undefined;
        if (res && typeof res === 'object' && !Array.isArray(res)) {
          const resultObj = res as Record<string, unknown>;
          if (typeof resultObj.access_token === 'string') {
            access_token = resultObj.access_token;
          }
        }

        return {
          ...baseResponse,
          message: finalMessage,
          data,
          meta,
          access_token,
        } as ApiResponse<T>;
      }),
    );
  }
}
