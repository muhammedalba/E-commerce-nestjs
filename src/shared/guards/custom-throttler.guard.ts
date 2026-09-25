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
import { isIP } from 'net';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import {
  getTrustedProxies,
  normalizeIp,
} from 'src/shared/utils/trusted-proxies';

const INTERNAL_KEY_HEADER = 'x-internal-key';
const CLIENT_IP_HEADER = 'x-client-ip';

type HeaderBag = { headers: Record<string, string | string[] | undefined> };

/**
 * Extends the default ThrottlerGuard to:
 * - return a clear, localized (ar/en) message instead of the generic
 *   "ThrottlerException: Too Many Requests";
 * - handle requests from the Next.js server, which all share its IP and are
 *   authenticated with the shared INTERNAL_API_KEY (`x-internal-key`):
 *   - with `x-client-ip` → a browser request relayed through the site's
 *     /api/v1 rewrite: rate-limited per original client IP;
 *   - without it → the Next server's own fetches (build, ISR, SSR): skipped.
 *   `x-client-ip` is ignored unless the key is valid, so clients can't spoof it.
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
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<HeaderBag>();
      // Next server's own fetch (not relaying a browser request)
      if (this.hasValidInternalKey(req) && !req.headers[CLIENT_IP_HEADER]) {
        return true;
      }
    }
    return super.shouldSkip(context);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const { headers } = req as HeaderBag;

    // Browser request relayed by the Next.js server
    const relayedIp = headers[CLIENT_IP_HEADER];
    if (
      typeof relayedIp === 'string' &&
      isIP(relayedIp) &&
      this.hasValidInternalKey(req as HeaderBag)
    ) {
      return relayedIp;
    }

    // CDNs that pass the client only in a dedicated header (CLIENT_IP_HEADER,
    // e.g. true-client-ip). Honored only when every hop was a trusted proxy,
    // i.e. req.ip itself is one — otherwise the header could be client-sent.
    const cdnHeader = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
    const ip = (req as { ip?: string }).ip;
    if (cdnHeader && ip && getTrustedProxies().isTrusted(ip)) {
      const cdnIp = headers[cdnHeader];
      if (typeof cdnIp === 'string' && isIP(normalizeIp(cdnIp))) {
        return normalizeIp(cdnIp);
      }
    }

    return super.getTracker(req);
  }

  private hasValidInternalKey(req: HeaderBag): boolean {
    if (!this.internalKey) return false;
    const header = req.headers[INTERNAL_KEY_HEADER];
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
