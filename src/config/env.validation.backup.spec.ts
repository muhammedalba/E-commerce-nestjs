import 'reflect-metadata';
import { validateEnv } from './env.validation';

const BASE = {
  MONGODB_URI: 'mongodb://localhost/test',
  BASE_URL: 'http://localhost:4000',
  CLIENT_URL: 'http://localhost:3000',
  JWT_PRIVATE_KEY: 'x',
  JWT_PUBLIC_KEY: 'x',
  MAIL_HOST: 'smtp.example.com',
  MAIL_PORT: '587',
  MAIL_USERNAME: 'mail@example.com',
  MAIL_PASSWORD: 'x',
  MAIL_FROM_ADDRESS: 'mail@example.com',
  ADMIN_EMAIL: 'admin@example.com',
  SUPPORT_LINK: 'http://localhost:3000/support',
  LOGIN_LINK: 'http://localhost:3000/login',
  REDIS_URL: 'redis://localhost:6379',
  MAIL_RETRY_ATTEMPTS: '3',
  MAIL_RETRY_DELAY: '1000',
  MOYASAR_SECRET_KEY: 'x',
  PAYMENT_CONFIG_SECRET: 'x',
};

const KEY = Buffer.alloc(32, 1).toString('base64');
const ENABLED = {
  BACKUP_ENABLED: 'true',
  BACKUP_ENCRYPTION_KEY: KEY,
  GDRIVE_CLIENT_ID: 'id.apps.googleusercontent.com',
  GDRIVE_CLIENT_SECRET: 'secret',
  GDRIVE_REFRESH_TOKEN: '1//token',
};

describe('env validation: backups', () => {
  it('defaults to disabled and accepts the empty values of .env.example', () => {
    const env = validateEnv({
      ...BASE,
      BACKUP_ENABLED: 'false',
      BACKUP_ENCRYPTION_KEY: '',
      GDRIVE_CLIENT_ID: '',
      BACKUP_CRON: '',
      BACKUP_ALERT_EMAIL: '',
      BACKUP_TIMEZONE: '',
      BACKUP_READ_PREFERENCE: '',
      BACKUP_RETENTION_DAYS: '',
      BACKUP_BATCH_SIZE: '',
    });
    expect(env.BACKUP_ENABLED).toBe(false);
    expect(env.BACKUP_RETENTION_DAYS).toBe(14);
    expect(env.BACKUP_BATCH_SIZE).toBe(1000);
    expect(env.BACKUP_TIMEZONE).toBe('Asia/Riyadh');
    expect(env.BACKUP_READ_PREFERENCE).toBe('secondaryPreferred');
    expect(env.BACKUP_CRON).toBeUndefined();
  });

  it('treats BACKUP_ENABLED=false as disabled (not a truthy string)', () => {
    expect(
      validateEnv({ ...BASE, ...ENABLED, BACKUP_ENABLED: 'false' })
        .BACKUP_ENABLED,
    ).toBe(false);
    expect(validateEnv({ ...BASE, BACKUP_ENABLED: '0' }).BACKUP_ENABLED).toBe(
      false,
    );
  });

  it('works without any backup variables', () => {
    expect(validateEnv({ ...BASE }).BACKUP_ENABLED).toBe(false);
  });

  it('validates every required variable once enabled', () => {
    expect(() => validateEnv({ ...BASE, BACKUP_ENABLED: 'true' })).toThrow(
      /BACKUP_ENCRYPTION_KEY|GDRIVE_CLIENT_ID/,
    );
    expect(validateEnv({ ...BASE, ...ENABLED }).BACKUP_ENABLED).toBe(true);
  });

  it.each([
    [
      'short key',
      { BACKUP_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') },
      /BACKUP_ENCRYPTION_KEY/,
    ],
    ['bad cron', { BACKUP_CRON: 'every day' }, /BACKUP_CRON/],
    ['6-field cron', { BACKUP_CRON: '0 0 3 * * *' }, /BACKUP_CRON/],
    ['bad timezone', { BACKUP_TIMEZONE: 'Mars/Base' }, /BACKUP_TIMEZONE/],
    ['zero retention', { BACKUP_RETENTION_DAYS: '0' }, /BACKUP_RETENTION_DAYS/],
    [
      'fractional retention',
      { BACKUP_RETENTION_DAYS: '1.5' },
      /BACKUP_RETENTION_DAYS/,
    ],
    [
      'bad alert email',
      { BACKUP_ALERT_EMAIL: 'not-an-email' },
      /BACKUP_ALERT_EMAIL/,
    ],
    [
      'bad read preference',
      { BACKUP_READ_PREFERENCE: 'fastest' },
      /BACKUP_READ_PREFERENCE/,
    ],
    [
      'empty refresh token',
      { GDRIVE_REFRESH_TOKEN: '' },
      /GDRIVE_REFRESH_TOKEN/,
    ],
  ])('rejects %s', (_label, over, message) => {
    expect(() => validateEnv({ ...BASE, ...ENABLED, ...over })).toThrow(
      message,
    );
  });

  it('accepts a valid cron override and parses booleans strictly', () => {
    const env = validateEnv({
      ...BASE,
      ...ENABLED,
      BACKUP_CRON: '0 */6 * * *',
      BACKUP_ALLOW_NON_SNAPSHOT: 'false',
    });
    expect(env.BACKUP_CRON).toBe('0 */6 * * *');
    expect(env.BACKUP_ALLOW_NON_SNAPSHOT).toBe(false);
  });
});

describe('env validation: database name and old keys', () => {
  it('defaults MONGODB_DB_NAME to skyGalaxy (also when empty)', () => {
    expect(validateEnv({ ...BASE }).MONGODB_DB_NAME).toBe('skyGalaxy');
    expect(validateEnv({ ...BASE, MONGODB_DB_NAME: '' }).MONGODB_DB_NAME).toBe(
      'skyGalaxy',
    );
    expect(
      validateEnv({ ...BASE, MONGODB_DB_NAME: 'skyGalaxy_restored' })
        .MONGODB_DB_NAME,
    ).toBe('skyGalaxy_restored');
  });

  it.each(['sky.galaxy', 'sky galaxy', 'a/b', 'x'.repeat(64), 'db$'])(
    'rejects MONGODB_DB_NAME=%p',
    (name) => {
      expect(() => validateEnv({ ...BASE, MONGODB_DB_NAME: name })).toThrow(
        /MONGODB_DB_NAME/,
      );
    },
  );

  it('validates BACKUP_DECRYPTION_KEYS', () => {
    const old = Buffer.alloc(32, 2).toString('base64');
    expect(
      validateEnv({ ...BASE, BACKUP_DECRYPTION_KEYS: `${old}, ${KEY}` })
        .BACKUP_DECRYPTION_KEYS,
    ).toBeTruthy();
    expect(() =>
      validateEnv({ ...BASE, BACKUP_DECRYPTION_KEYS: `${old},short` }),
    ).toThrow(/BACKUP_DECRYPTION_KEYS/);
  });
});

describe('env validation: panel limits', () => {
  it('defaults the test-restore and upload limits', () => {
    const env = validateEnv({ ...BASE });
    expect(env.BACKUP_TEST_RESTORE_MAX_MB).toBe(200);
    expect(env.BACKUP_UPLOAD_MAX_MB).toBe(512);
  });

  it('treats an empty test-restore limit as "no limit"', () => {
    expect(
      validateEnv({ ...BASE, BACKUP_TEST_RESTORE_MAX_MB: '' })
        .BACKUP_TEST_RESTORE_MAX_MB,
    ).toBeNull();
  });

  it.each([
    ['BACKUP_TEST_RESTORE_MAX_MB', '0'],
    ['BACKUP_TEST_RESTORE_MAX_MB', 'abc'],
    ['BACKUP_UPLOAD_MAX_MB', '0'],
    ['BACKUP_UPLOAD_MAX_MB', '99999'],
  ])('rejects %s=%p', (name, value) => {
    expect(() => validateEnv({ ...BASE, [name]: value })).toThrow(name);
  });
});

describe('env validation: backup worker', () => {
  it('runs backup jobs by default and can be turned off per instance', () => {
    expect(validateEnv({ ...BASE }).BACKUP_WORKER_ENABLED).toBe(true);
    expect(
      validateEnv({ ...BASE, BACKUP_WORKER_ENABLED: '' }).BACKUP_WORKER_ENABLED,
    ).toBe(true);
    expect(
      validateEnv({ ...BASE, BACKUP_WORKER_ENABLED: 'false' })
        .BACKUP_WORKER_ENABLED,
    ).toBe(false);
  });
});
