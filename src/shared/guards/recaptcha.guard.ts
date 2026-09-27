import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

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
 * Google reCAPTCHA v3 guard.
 * The client sends the token in the `x-recaptcha-token` header.
 * Disabled (pass-through) when RECAPTCHA_SECRET_KEY is not set.
 *
 * When Google itself is unreachable the request is accepted but flagged
 * (see {@link RecaptchaUnverified}) so a real customer is never lost to an outage.
 *
 * Usage: @UseGuards(new RecaptchaGuard('contact'))
 */
@Injectable()
export class RecaptchaGuard implements CanActivate {
  private static readonly logger = new Logger(RecaptchaGuard.name);
  private static missingSecretWarned = false;

  constructor(private readonly expectedAction: string) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const logger = RecaptchaGuard.logger;
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      if (!RecaptchaGuard.missingSecretWarned) {
        RecaptchaGuard.missingSecretWarned = true;
        logger.warn('RECAPTCHA_SECRET_KEY is not set — skipping verification');
      }
      return true;
    }

    const req = context.switchToHttp().getRequest<RecaptchaRequest>();
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

/** `true` when the request passed RecaptchaGuard only because Google was unreachable. */
export const RecaptchaUnverified = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): boolean =>
    !!ctx.switchToHttp().getRequest<RecaptchaRequest>().recaptchaUnverified,
);
