import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  Matches,
  MinLength,
  ValidateIf,
  ValidationArguments,
  registerDecorator,
  validateSync,
} from 'class-validator';
import { CronExpressionParser } from 'cron-parser';
import { isValidBackupKey } from '../backup/backup-format';
import { isValidTimeZone } from '../backup/store-timezone';
import {
  CLIENT_ACCESS_MODES,
  ClientAccessMode,
} from '../shared/guards/client-access.guard';

type RawTransform = { obj: Record<string, unknown>; key: string };

/**
 * Transforms below read the raw env string (obj[key]): with
 * enableImplicitConversion, `value` is already converted and 'false' would
 * have become true, '' would have become 0.
 */
const toBool = ({ obj, key }: RawTransform) =>
  obj[key] === true || obj[key] === 'true' || obj[key] === '1';

const toInt =
  (fallback: number) =>
  ({ obj, key }: RawTransform) =>
    obj[key] === undefined || obj[key] === '' ? fallback : Number(obj[key]);

function IsValid(
  check: (value: unknown) => boolean,
  message: (args: ValidationArguments) => string,
) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: { message },
      validator: { validate: check },
    });
}

const backupOn = (o: EnvironmentVariables) => o.BACKUP_ENABLED === true;

/** An empty value in .env (KEY=) means unset, not invalid. */
const emptyAs =
  (fallback?: unknown) =>
  ({ obj, key }: RawTransform) =>
    obj[key] === undefined || obj[key] === null || obj[key] === ''
      ? fallback
      : obj[key];

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

  /**
   * Database used inside the MONGODB_URI cluster/server. Changing it points
   * the app at another database (e.g. one restored from a backup); it does
   * not move data.
   */
  @Transform(emptyAs('skyGalaxy'))
  @IsOptional()
  @Matches(/^[^/\\. "$*<>:|?]{1,63}$/, {
    message:
      'MONGODB_DB_NAME must be 1-63 characters without / \\ . " $ * < > : | ? or spaces',
  })
  MONGODB_DB_NAME: string = 'skyGalaxy';

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

  // Who may use the API (ClientAccessGuard): the website (x-internal-key) and
  // the mobile app (App Check). off | report (default: log only) | enforce (403).
  @Transform(emptyAs())
  @IsOptional()
  @IsIn(CLIENT_ACCESS_MODES)
  CLIENT_ACCESS_MODE?: ClientAccessMode;

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

  // ── Database backups (docs/BACKUP.md) ────────────────────────────────────
  // All optional while BACKUP_ENABLED is false; required and validated at
  // startup once it is true. Values are never logged.

  /** Server master switch; the admin toggle only works when this is true. */
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  BACKUP_ENABLED: boolean = false;

  /** Base64 of 32 random bytes (npm run backup:keygen). Keep a copy off-server. */
  @ValidateIf(backupOn)
  @IsValid(
    (v) => typeof v === 'string' && isValidBackupKey(v),
    () =>
      'BACKUP_ENCRYPTION_KEY must be base64 that decodes to exactly 32 bytes',
  )
  BACKUP_ENCRYPTION_KEY?: string;

  @ValidateIf(backupOn)
  @IsString()
  @IsNotEmpty()
  GDRIVE_CLIENT_ID?: string;

  @ValidateIf(backupOn)
  @IsString()
  @IsNotEmpty()
  GDRIVE_CLIENT_SECRET?: string;

  /** From npm run backup:auth (scope drive.file). */
  @ValidateIf(backupOn)
  @IsString()
  @IsNotEmpty()
  GDRIVE_REFRESH_TOKEN?: string;

  /** Optional ops/dev override of the admin schedule (5-field cron). */
  @Transform(emptyAs())
  @IsOptional()
  @IsValid(
    (v) => {
      if (typeof v !== 'string' || !v.trim()) return false;
      try {
        CronExpressionParser.parse(v);
        return v.trim().split(/\s+/).length === 5;
      } catch {
        return false;
      }
    },
    () => 'BACKUP_CRON must be a valid 5-field cron expression',
  )
  BACKUP_CRON?: string;

  /** Default retention (days) until an admin saves one. */
  @Transform(toInt(14))
  @IsInt()
  @Min(1)
  @IsOptional()
  BACKUP_RETENTION_DAYS: number = 14;

  /** Used only when the store's business address yields no timezone. */
  @Transform(emptyAs('Asia/Riyadh'))
  @IsOptional()
  @IsValid(
    (v) => typeof v === 'string' && isValidTimeZone(v),
    () => 'BACKUP_TIMEZONE must be a valid IANA timezone (e.g. Asia/Riyadh)',
  )
  BACKUP_TIMEZONE: string = 'Asia/Riyadh';

  /** Failure alerts; defaults to ADMIN_EMAIL. */
  @Transform(emptyAs())
  @IsOptional()
  @IsEmail()
  BACKUP_ALERT_EMAIL?: string;

  @Transform(toInt(1000))
  @IsInt()
  @Min(1)
  @Max(10_000)
  @IsOptional()
  BACKUP_BATCH_SIZE: number = 1000;

  @Transform(emptyAs('secondaryPreferred'))
  @IsOptional()
  @IsIn([
    'primary',
    'primaryPreferred',
    'secondary',
    'secondaryPreferred',
    'nearest',
  ])
  BACKUP_READ_PREFERENCE: string = 'secondaryPreferred';

  /**
   * Whether this instance runs backup jobs (default true). Set false on API
   * instances when a separate instance (same code) is dedicated to backups,
   * so exports, compression and uploads never compete with the store.
   */
  @Transform(({ obj, key }: RawTransform) =>
    obj[key] === undefined || obj[key] === '' ? true : toBool({ obj, key }),
  )
  @IsBoolean()
  @IsOptional()
  BACKUP_WORKER_ENABLED: boolean = true;

  /** Explicit opt-in to non point-in-time backups if snapshots are unsupported. */
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  BACKUP_ALLOW_NON_SNAPSHOT: boolean = false;

  /** Test restores are refused when the live database is larger (MB). Empty = no limit. */
  @Transform(({ obj, key }: RawTransform) =>
    obj[key] === undefined ? 200 : obj[key] === '' ? null : Number(obj[key]),
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  BACKUP_TEST_RESTORE_MAX_MB: number | null = 200;

  /** The test-restore database is dropped this many hours after it was made (0 = keep). */
  @Transform(toInt(24))
  @IsInt()
  @Min(0)
  @IsOptional()
  BACKUP_TEST_RESTORE_TTL_HOURS: number = 24;

  /** Largest backup file or bundle the admin panel accepts (MB). */
  @Transform(toInt(512))
  @IsInt()
  @Min(1)
  @Max(10_240)
  @IsOptional()
  BACKUP_UPLOAD_MAX_MB: number = 512;

  /** Older keys after a rotation (comma-separated), to read old backups. */
  @Transform(emptyAs())
  @IsOptional()
  @IsValid(
    (v) =>
      typeof v === 'string' &&
      v.split(',').every((k) => isValidBackupKey(k.trim())),
    () =>
      'BACKUP_DECRYPTION_KEYS must be comma-separated base64 keys of 32 bytes',
  )
  BACKUP_DECRYPTION_KEYS?: string;

  /** Initial Drive folder name (admins can rename it later). */
  @Transform(emptyAs())
  @IsOptional()
  @IsString()
  BACKUP_FOLDER_NAME?: string;
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

  if (validatedConfig.CLIENT_ACCESS_MODE === 'enforce') {
    // Without the key the website itself would be blocked
    if (
      validatedConfig.NODE_ENV === Environment.Production &&
      !validatedConfig.INTERNAL_API_KEY
    ) {
      throw new Error(
        'CLIENT_ACCESS_MODE=enforce requires INTERNAL_API_KEY (shared with the website)',
      );
    }
    if (!validatedConfig.FIREBASE_PROJECT_NUMBER) {
      console.warn(
        'CLIENT_ACCESS_MODE=enforce without FIREBASE_PROJECT_NUMBER: the mobile app will be blocked',
      );
    }
  }
  return validatedConfig;
}
