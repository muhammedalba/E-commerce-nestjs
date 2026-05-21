import { Provider } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MaintenanceGuard } from './shared/guards/maintenance.guard';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { AppService } from './app.service';
import { ExistsConstraint } from './shared/utils/decorators/exists.decorator';
import { CustomI18nValidationExceptionFilter } from './filters/i18n-validation-exception.filter';

export const appProviders: Provider[] = [
  // Global rate limiter guard
  {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  },
  // Global maintenance mode guard
  {
    provide: APP_GUARD,
    useClass: MaintenanceGuard,
  },
  // Global API response standardization interceptor
  {
    provide: APP_INTERCEPTOR,
    useClass: TransformInterceptor,
  },
  // Global slow/fast HTTP requests performance logging interceptor
  {
    provide: APP_INTERCEPTOR,
    useClass: LoggingInterceptor,
  },
  AppService,
  ExistsConstraint,
  CustomI18nValidationExceptionFilter,
];
