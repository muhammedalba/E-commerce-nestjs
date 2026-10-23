import { Provider } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MaintenanceGuard } from './shared/guards/maintenance.guard';
import { AppVersionGuard } from './shared/guards/app-version.guard';
import { CustomThrottlerGuard } from './shared/guards/custom-throttler.guard';
import { ClientAccessGuard } from './shared/guards/client-access.guard';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { AppService } from './app.service';
import { ExistsConstraint } from './shared/utils/decorators/exists.decorator';
import { CustomI18nValidationExceptionFilter } from './filters/i18n-validation-exception.filter';

export const appProviders: Provider[] = [
  // Global client guard: only the website and the mobile app. First, so an
  // unknown client is rejected before it uses rate-limit quota.
  {
    provide: APP_GUARD,
    useClass: ClientAccessGuard,
  },
  // Global rate limiter guard
  {
    provide: APP_GUARD,
    useClass: CustomThrottlerGuard,
  },
  // Global mobile app forced-update guard (426). Before maintenance, so an
  // unsupported app shows its update screen rather than the maintenance one.
  {
    provide: APP_GUARD,
    useClass: AppVersionGuard,
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
