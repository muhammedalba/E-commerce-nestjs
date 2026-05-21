import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { SettingsService } from 'src/settings/settings.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly settingsService: SettingsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.settingsService
          .getSettings()
          .then((settings) => {
            if (!settings?.debugMode) return;

            const response = ctx.getResponse<Response>();
            const statusCode = response.statusCode;
            const responseTime = Date.now() - now;

            // Ignore Server-Sent Events (SSE) long-lived connections
            const isSSE =
              response.getHeader('Content-Type') === 'text/event-stream';
            if (isSSE) return;

            // Log a warning if the request takes more than 100ms
            if (responseTime > 100) {
              this.logger.warn(
                `[SLOW] ${method} ${url} status:${statusCode} time:${responseTime}ms`,
              );
            } else {
              this.logger.log(
                `[Fast] ${method} ${url} status:${statusCode} time:${responseTime}ms`,
              );
            }
          })
          .catch(() => {
            // If fetching settings fails, default to ignoring logging
          });
      }),
    );
  }
}
