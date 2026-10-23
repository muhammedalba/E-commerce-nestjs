import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { getAllowedOrigins, toOrigin } from 'src/config/allowed-origins';
import { ALLOW_ANY_CLIENT_KEY } from 'src/shared/decorators/allow-any-client.decorator';
import { hasValidInternalKey } from 'src/shared/utils/internal-key.util';
import { verifyAppCheckToken } from './app-check.verifier';

export type ClientAccessMode = 'off' | 'report' | 'enforce';

export const CLIENT_ACCESS_MODES: readonly ClientAccessMode[] = [
  'off',
  'report',
  'enforce',
];

const APP_CHECK_HEADER = 'x-firebase-appcheck';

/** CLIENT_ACCESS_MODE, defaulting to `report` when unset or unknown. */
export function clientAccessMode(): ClientAccessMode {
  const value = process.env.CLIENT_ACCESS_MODE?.trim().toLowerCase();
  return CLIENT_ACCESS_MODES.includes(value as ClientAccessMode)
    ? (value as ClientAccessMode)
    : 'report';
}

/**
 * Lets only the website and the mobile app use the API:
 * - the Next.js server (SSR, and browser requests relayed by the site's
 *   /api/v1 proxy) → valid `x-internal-key`;
 * - the mobile app → valid Firebase App Check token (`x-firebase-appcheck`);
 * - in development only, a browser whose Origin is an allowed origin (the
 *   dev client calls the API directly). Origin is never trusted in
 *   production: any non-browser client can set it.
 * Routes marked @AllowAnyClient() (webhooks, OAuth, health) are skipped.
 *
 * CLIENT_ACCESS_MODE: `off` (no check), `report` (default: log, but allow)
 * or `enforce` (403). Roll out with `report`, then switch to `enforce`.
 */
@Injectable()
export class ClientAccessGuard implements CanActivate {
  private static readonly logger = new Logger(ClientAccessGuard.name);
  private readonly mode = clientAccessMode();
  private readonly devOrigins =
    process.env.NODE_ENV === 'development' ? getAllowedOrigins() : [];

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.mode === 'off' || context.getType() !== 'http') return true;

    const exempt = this.reflector.getAllAndOverride<boolean>(
      ALLOW_ANY_CLIENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (exempt) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (hasValidInternalKey(req)) return true;

    const appCheckToken = req.headers[APP_CHECK_HEADER];
    if (typeof appCheckToken === 'string' && appCheckToken) {
      const result = await verifyAppCheckToken(appCheckToken);
      if (result === 'valid') return true;
      if (result === 'unavailable') {
        // Firebase unreachable: never lose a real app user to an outage
        ClientAccessGuard.logger.error(
          'App Check unavailable, accepting as unverified',
        );
        return true;
      }
    }

    const origin = toOrigin(req.headers.origin);
    if (origin && this.devOrigins.some((o) => toOrigin(o) === origin)) {
      return true;
    }

    return this.reject(req, typeof appCheckToken === 'string');
  }

  private reject(req: Request, hadAppCheck: boolean): boolean {
    const reason = hadAppCheck ? 'invalid App Check token' : 'unknown client';
    ClientAccessGuard.logger.warn(
      `${this.mode === 'enforce' ? 'Blocked' : 'Would block'} (${reason}): ` +
        `${req.method} ${req.originalUrl ?? req.url} ip=${req.ip} ` +
        `origin=${req.headers.origin ?? '-'} ua=${req.headers['user-agent'] ?? '-'}`,
    );
    if (this.mode === 'enforce') {
      throw new ForbiddenException('Client not allowed');
    }
    return true;
  }
}
