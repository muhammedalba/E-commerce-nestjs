import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { isAppCheckEnabled, verifyAppCheckToken } from './app-check.verifier';

interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

type RecaptchaRequest = Request & { recaptchaUnverified?: boolean };

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const VERIFY_TIMEOUT_MS = 5000;

/**
 * Hostnames a token may be issued on (production only).
 * RECAPTCHA_HOSTNAMES (comma-separated) overrides CLIENT_URL / FRONTEND_ORIGIN.
 */
function allowedHostnames(): string[] {
  const explicit = process.env.RECAPTCHA_HOSTNAMES;
  const sources = explicit
    ? explicit.split(',')
    : [process.env.CLIENT_URL, process.env.FRONTEND_ORIGIN];

  return sources
    .map((value) => value?.trim())
    .filter((value): value is string => !!value)
    .map((value) => {
      try {
        return new URL(value.includes('://') ? value : `https://${value}`)
          .hostname;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

/**
 * Bot check for public forms: Google reCAPTCHA v3 for the website, Firebase
 * App Check for the mobile app.
 *
 * - Website: token in the `x-recaptcha-token` header. Disabled (pass-through)
 *   when RECAPTCHA_SECRET_KEY is not set.
 * - Mobile app: token in the `x-firebase-appcheck` header, verified when
 *   FIREBASE_PROJECT_NUMBER is set; otherwise the request falls back to the
 *   reCAPTCHA check.
 *
 * When Google / Firebase is unreachable the request is accepted but flagged
 * (see {@link RecaptchaUnverified}) so a real customer is never lost to an outage.
 *
 * Usage: @UseGuards(new RecaptchaGuard('contact'))
 */
@Injectable()
export class RecaptchaGuard implements CanActivate {
  private static readonly logger = new Logger(RecaptchaGuard.name);
  private static missingSecretWarned = false;
  private static appCheckOffWarned = false;

  constructor(private readonly expectedAction: string) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const logger = RecaptchaGuard.logger;
    const req = context.switchToHttp().getRequest<RecaptchaRequest>();

    const appCheckToken = req.headers['x-firebase-appcheck'];
    if (typeof appCheckToken === 'string' && appCheckToken) {
      if (isAppCheckEnabled()) {
        const result = await verifyAppCheckToken(appCheckToken);
        if (result === 'invalid') {
          throw new ForbiddenException('App Check verification failed');
        }
        if (result === 'unavailable') {
          logger.error('App Check unavailable, accepting as unverified');
          req.recaptchaUnverified = true;
        }
        return true;
      }
      if (!RecaptchaGuard.appCheckOffWarned) {
        RecaptchaGuard.appCheckOffWarned = true;
        logger.warn(
          'App Check token received but FIREBASE_PROJECT_NUMBER is not set — using reCAPTCHA rules',
        );
      }
    }

    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      if (!RecaptchaGuard.missingSecretWarned) {
        RecaptchaGuard.missingSecretWarned = true;
        logger.warn('RECAPTCHA_SECRET_KEY is not set — skipping verification');
      }
      return true;
    }

    const token = req.headers['x-recaptcha-token'];
    if (typeof token !== 'string' || !token) {
      throw new ForbiddenException('reCAPTCHA token is missing');
    }

    let result: RecaptchaVerifyResponse;
    try {
      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret,
          response: token,
          remoteip: req.ip ?? '',
        }),
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      result = (await res.json()) as RecaptchaVerifyResponse;
    } catch (err) {
      // Google unreachable / timed out: accept, but flag for manual review
      logger.error(
        `reCAPTCHA verification unavailable, accepting as unverified: ${String(err)}`,
      );
      req.recaptchaUnverified = true;
      return true;
    }

    const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? 0.5);
    const hostnames =
      process.env.NODE_ENV === 'production' ? allowedHostnames() : [];
    const hostnameOk =
      hostnames.length === 0 ||
      (!!result.hostname && hostnames.includes(result.hostname));

    if (
      !result.success ||
      result.action !== this.expectedAction ||
      (result.score ?? 0) < minScore ||
      !hostnameOk
    ) {
      logger.warn(
        `reCAPTCHA rejected: success=${result.success} action=${result.action} score=${result.score} hostname=${result.hostname} errors=${result['error-codes']?.join(',')}`,
      );
      throw new ForbiddenException('reCAPTCHA verification failed');
    }

    return true;
  }
}

/** `true` when the request passed RecaptchaGuard only because Google / Firebase was unreachable. */
export const RecaptchaUnverified = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): boolean =>
    !!ctx.switchToHttp().getRequest<RecaptchaRequest>().recaptchaUnverified,
);
