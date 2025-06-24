import { ExceptionFilter, Catch, ArgumentsHost, Inject } from '@nestjs/common';
import { I18nService, I18nValidationException } from 'nestjs-i18n';
import { Response } from 'express';
import { ValidationError } from 'class-validator';

@Catch(I18nValidationException)
export class CustomI18nValidationExceptionFilter implements ExceptionFilter {
  constructor(@Inject(I18nService) private readonly i18n: I18nService) {}

  async catch(exception: I18nValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const errors = exception.errors ?? [];

    const messages = await this.extractMessages(errors);

    return response.status(status).json({
      statusCode: status,
      messages,
    });
  }

  private async extractMessages(
    errors: ValidationError[],
    parentPath = '',
  ): Promise<string[]> {
    const messages: string[] = [];

    for (const error of errors) {
      const propertyPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      if (error.constraints) {
        for (const key in error.constraints) {
          let translated = await this.i18n.translate(error.constraints[key]);

          // استبدال {property} باسم الحقل الكامل
          if (typeof translated === 'string') {
            translated = translated.replace(/\{property\}/g, propertyPath);
            messages.push(String(translated));
          } else {
            messages.push(String(translated));
          }
        }
      }

      if (error.children && error.children.length > 0) {
        const childMessages = await this.extractMessages(
          error.children,
          propertyPath,
        );
        messages.push(...childMessages);
      }
    }

    return messages;
  }
}
