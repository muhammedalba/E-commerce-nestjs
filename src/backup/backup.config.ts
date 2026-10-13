import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  backupKeyId,
  decodeBackupKey,
  isValidBackupKey,
} from './backup-format';
import { DEFAULT_FOLDER_NAME } from './backup.types';

export type BackupReadPreference =
  | 'primary'
  | 'primaryPreferred'
  | 'secondary'
  | 'secondaryPreferred'
  | 'nearest';

/**
 * Server-side backup configuration (environment only). Secrets are read here
 * and never leave this class except as the decoded key handed to the
 * encryption stream and the OAuth credentials handed to the Drive client.
 *
 * Precedence with the admin settings:
 * - BACKUP_ENABLED is the server master switch; a backup runs only when it
 *   AND the admin toggle are on (and credentials are configured).
 * - BACKUP_CRON, if set, overrides the admin schedule (ops/dev only).
 * - BACKUP_RETENTION_DAYS only seeds the admin default.
 * - BACKUP_TIMEZONE is used only when the store address gives no timezone.
 */
@Injectable()
export class BackupConfig {
  constructor(private readonly config: ConfigService) {}

  get serverEnabled(): boolean {
    return this.config.get<boolean>('BACKUP_ENABLED') === true;
  }

  /** False: this instance leaves backup jobs to another one (BACKUP_WORKER_ENABLED). */
  get workerEnabled(): boolean {
    return this.config.get<boolean>('BACKUP_WORKER_ENABLED') !== false;
  }

  get cronOverride(): string | undefined {
    return this.config.get<string>('BACKUP_CRON')?.trim() || undefined;
  }

  get retentionDefault(): number {
    return this.config.get<number>('BACKUP_RETENTION_DAYS') ?? 14;
  }

  get fallbackTimezone(): string {
    return this.config.get<string>('BACKUP_TIMEZONE') || 'Asia/Riyadh';
  }

  get folderNameDefault(): string {
    return this.config.get<string>('BACKUP_FOLDER_NAME') || DEFAULT_FOLDER_NAME;
  }

  /** Live dataSize above which a test restore is refused (null = no limit). */
  get testRestoreMaxBytes(): number | null {
    const mb = this.config.get<number | null>('BACKUP_TEST_RESTORE_MAX_MB');
    return mb ? mb * 1024 * 1024 : null;
  }

  /** Age after which the test-restore database is dropped (null = never). */
  get testRestoreTtlMs(): number | null {
    const hours =
      this.config.get<number>('BACKUP_TEST_RESTORE_TTL_HOURS') ?? 24;
    return hours > 0 ? hours * 60 * 60 * 1000 : null;
  }

  /** Largest backup file/bundle accepted from the admin panel. */
  get uploadMaxBytes(): number {
    return (
      (this.config.get<number>('BACKUP_UPLOAD_MAX_MB') ?? 512) * 1024 * 1024
    );
  }

  get batchSize(): number {
    return this.config.get<number>('BACKUP_BATCH_SIZE') ?? 1000;
  }

  get readPreference(): BackupReadPreference {
    return (
      this.config.get<BackupReadPreference>('BACKUP_READ_PREFERENCE') ??
      'secondaryPreferred'
    );
  }

  get allowNonSnapshot(): boolean {
    return this.config.get<boolean>('BACKUP_ALLOW_NON_SNAPSHOT') === true;
  }

  get alertEmail(): string | undefined {
    return (
      this.config.get<string>('BACKUP_ALERT_EMAIL') ||
      this.config.get<string>('ADMIN_EMAIL') ||
      undefined
    );
  }

  /** Language of alert emails. */
  get defaultLanguage(): 'ar' | 'en' {
    return this.config.get<string>('DEFAULT_LANGUAGE') === 'en' ? 'en' : 'ar';
  }

  get driveCredentials(): {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  } {
    return {
      clientId: this.config.get<string>('GDRIVE_CLIENT_ID') ?? '',
      clientSecret: this.config.get<string>('GDRIVE_CLIENT_SECRET') ?? '',
      refreshToken: this.config.get<string>('GDRIVE_REFRESH_TOKEN') ?? '',
    };
  }

  /** Names (never values) of required variables that are missing or invalid. */
  missingCredentials(): string[] {
    const { clientId, clientSecret, refreshToken } = this.driveCredentials;
    const missing: string[] = [];
    if (!clientId) missing.push('GDRIVE_CLIENT_ID');
    if (!clientSecret) missing.push('GDRIVE_CLIENT_SECRET');
    if (!refreshToken) missing.push('GDRIVE_REFRESH_TOKEN');
    if (!isValidBackupKey(this.config.get<string>('BACKUP_ENCRYPTION_KEY'))) {
      missing.push('BACKUP_ENCRYPTION_KEY');
    }
    return missing;
  }

  get credentialsConfigured(): boolean {
    return this.missingCredentials().length === 0;
  }

  encryptionKey(): Buffer {
    return decodeBackupKey(
      this.config.get<string>('BACKUP_ENCRYPTION_KEY') ?? '',
    );
  }

  /** Current key + older keys (BACKUP_DECRYPTION_KEYS) for reading old files. */
  decryptionKeys(): Buffer[] {
    const old = (this.config.get<string>('BACKUP_DECRYPTION_KEYS') ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter((k) => isValidBackupKey(k))
      .map((k) => decodeBackupKey(k));
    return [this.encryptionKey(), ...old];
  }

  encryptionKeyId(): string | null {
    try {
      return backupKeyId(this.encryptionKey());
    } catch {
      return null;
    }
  }
}
