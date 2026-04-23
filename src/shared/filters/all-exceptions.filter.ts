import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { I18nService, I18nValidationException } from 'nestjs-i18n';
import { Response, Request } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';

interface I18nValidationError {
  property: string;
  constraints?: Record<string, string>;
  children?: I18nValidationError[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(I18nService) private readonly i18n: I18nService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (res as any).message || exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Special handling for I18nValidationException
    if (exception instanceof I18nValidationException) {
      status = HttpStatus.BAD_REQUEST;
      const validationErrors =
        (exception.errors as I18nValidationError[]) ?? [];
      const translatedErrors =
        await this.extractValidationMessages(validationErrors);
      message = 'Validation failed';
      errors = translatedErrors;
    }

    const errorResponse: ApiResponse = {
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  private async extractValidationMessages(
    errors: I18nValidationError[],
    parentPath = '',
  ): Promise<string[]> {
    const messages: string[] = [];
    for (const error of errors) {
      const propertyPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;
      if (error.constraints) {
        for (const key in error.constraints) {
          const constraintValue = error.constraints[key];
          const translated = await this.i18n.translate(constraintValue);
          if (typeof translated === 'string') {
            messages.push(translated.replace(/\{property\}/g, propertyPath));
          } else {
            messages.push(String(translated));
          }
        }
      }
      if (error.children && error.children.length > 0) {
        const childMessages = await this.extractValidationMessages(
          error.children,
          propertyPath,
        );
        messages.push(...childMessages);
      }
    }
    return messages;
  }
}
