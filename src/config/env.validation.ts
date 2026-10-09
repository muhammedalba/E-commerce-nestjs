import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

  @IsString()
  MONGODB_URI!: string;

  @IsString()
  BASE_URL!: string;

  @IsString()
  CLIENT_URL!: string;

  @IsString()
  JWT_PRIVATE_KEY!: string;

  @IsString()
  JWT_PUBLIC_KEY!: string;

  // Shared secret the Next.js server sends as `x-internal-key` so its
  // server-side fetches (build, ISR, SSR) skip rate limiting. Optional:
  // when unset, no request can bypass the throttler.
  @IsString()
  @IsOptional()
  @MinLength(32)
  INTERNAL_API_KEY?: string;

  // Trusted proxies/CDNs in front of the API: comma-separated presets
  // (private, cloudflare), IPs or CIDR ranges. Loopback is always trusted.
  @IsString()
  @IsOptional()
  TRUSTED_PROXIES?: string;

  // Optional: header a CDN uses for the client IP (e.g. true-client-ip),
  // for CDNs that don't append it to X-Forwarded-For.
  @IsString()
  @IsOptional()
  CLIENT_IP_HEADER?: string;

  // Optional: comma-separated Google OAuth client IDs of the mobile apps
  // (iOS / Android), accepted as ID-token audiences besides GOOGLE_CLIENT_ID.
  @IsString()
  @IsOptional()
  GOOGLE_MOBILE_CLIENT_IDS?: string;

  // Optional: comma-separated bundle ids of the iOS apps; Sign in with Apple
  // identity tokens must be issued for one of them. Unset = Apple sign-in off.
  @IsString()
  @IsOptional()
  APPLE_BUNDLE_IDS?: string;

  // Optional: Firebase project number; when set, the mobile app's App Check
  // token (x-firebase-appcheck) replaces reCAPTCHA on the public forms.
  @IsString()
  @IsOptional()
  FIREBASE_PROJECT_NUMBER?: string;

  // Optional: comma-separated Firebase app ids allowed to send App Check tokens.
  @IsString()
  @IsOptional()
  FIREBASE_APP_IDS?: string;

  // Optional: Firebase service-account JSON key (raw or base64) used to send
  // phone pushes through FCM. Unset = push notifications off.
  @IsString()
  @IsOptional()
  FIREBASE_SERVICE_ACCOUNT?: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRE_TIME: string = '1d';

  @IsString()
  @IsOptional()
  JWT_REFRESH_TOKEN_EXPIRE_TIME: string = '7';

  @IsString()
  @IsOptional()
  LANGUAGES: string = 'ar,en';

  @IsString()
  @IsOptional()
  DEFAULT_LANGUAGE: string = 'ar';

  @IsString()
  MAIL_HOST!: string;
  @IsNumber()
  MAIL_PORT!: number;
  @IsEmail()
  MAIL_USERNAME!: string;
  @IsString()
  MAIL_PASSWORD!: string;
  @IsEmail()
  MAIL_FROM_ADDRESS!: string;
  @IsEmail()
  ADMIN_EMAIL!: string;
  @IsUrl({ require_tld: false }) // require_tld: false للسماح بـ localhost
  SUPPORT_LINK!: string;
  @IsUrl({ require_tld: false })
  LOGIN_LINK!: string;

  @IsString()
  REDIS_URL!: string;

  /** Max entries in the in-process response cache (LRU eviction beyond it). */
  @IsNumber()
  @IsOptional()
  CACHE_MAX_ITEMS: number = 1000;

  /** How often expired cache entries are swept from memory (ms, 0 = never). */
  @IsNumber()
  @IsOptional()
  CACHE_CHECK_INTERVAL_MS: number = 60_000;

  @IsNumber()
  MAIL_RETRY_ATTEMPTS!: number;

  @IsNumber()
  MAIL_RETRY_DELAY!: number;

  @IsString()
  MOYASAR_SECRET_KEY!: string;

  /** Key for payment-method secrets stored in the DB; changing it makes them unreadable. */
  @IsString()
  PAYMENT_CONFIG_SECRET!: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
