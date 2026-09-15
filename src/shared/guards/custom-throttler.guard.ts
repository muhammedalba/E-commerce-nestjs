import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

/**
 * Extends the default ThrottlerGuard to return a clear, localized (ar/en)
 * message instead of the generic "ThrottlerException: Too Many Requests".
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly i18n: CustomI18nService,
  ) {
    super(options, storageService, reflector);
  }

  protected getErrorMessage(): Promise<string> {
    return Promise.resolve(this.i18n.translate('exception.TOO_MANY_REQUESTS'));
  }
}
