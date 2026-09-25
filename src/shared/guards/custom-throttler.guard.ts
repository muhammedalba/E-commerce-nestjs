import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

const INTERNAL_KEY_HEADER = 'x-internal-key';

/**
 * Extends the default ThrottlerGuard to:
 * - return a clear, localized (ar/en) message instead of the generic
 *   "ThrottlerException: Too Many Requests";
 * - skip rate limiting for trusted server-to-server calls from the Next.js
 *   server (build, ISR, SSR), which otherwise all share the Next server's IP.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly internalKey = process.env.INTERNAL_API_KEY
    ? Buffer.from(process.env.INTERNAL_API_KEY)
    : null;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly i18n: CustomI18nService,
  ) {
    super(options, storageService, reflector);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (this.isTrustedInternalRequest(context)) return true;
    return super.shouldSkip(context);
  }

  private isTrustedInternalRequest(context: ExecutionContext): boolean {
    if (!this.internalKey || context.getType() !== 'http') return false;

    const header = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>()
      .headers[INTERNAL_KEY_HEADER];
    if (typeof header !== 'string') return false;

    const provided = Buffer.from(header);
    // timingSafeEqual throws on length mismatch, so compare lengths first
    return (
      provided.length === this.internalKey.length &&
      timingSafeEqual(provided, this.internalKey)
    );
  }

  protected getErrorMessage(): Promise<string> {
    return Promise.resolve(this.i18n.translate('exception.TOO_MANY_REQUESTS'));
  }
}
