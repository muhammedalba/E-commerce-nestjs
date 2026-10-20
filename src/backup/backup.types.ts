/** BullMQ queue that runs database backups. */
export const BACKUP_QUEUE = 'backup-queue';

/** Stable id of the single persistent job scheduler (one per environment prefix). */
export const BACKUP_SCHEDULER_ID = 'db-backup';

export const SCHEDULED_BACKUP_JOB = 'scheduled-backup';
export const MANUAL_BACKUP_JOB = 'manual-backup';

/** Deduplication id: at most one manual backup can be waiting or active. */
export const MANUAL_BACKUP_DEDUP_ID = 'db-backup-manual';

/** Scheduled runs per day the admin may choose (each divides 24 hours evenly). */
export const SUPPORTED_BACKUPS_PER_DAY = [1, 2, 3, 4, 6, 8, 12, 24] as const;
export type BackupsPerDay = (typeof SUPPORTED_BACKUPS_PER_DAY)[number];

/** Retention periods (days) the admin may choose. */
export const SUPPORTED_RETENTION_DAYS = [7, 14, 30, 60, 90] as const;
export type RetentionDays = (typeof SUPPORTED_RETENTION_DAYS)[number];

/** Retention never deletes the newest N valid backups, however old they are. */
export const MIN_BACKUPS_KEPT = 4;

/** 24-hour `HH:mm`. */
export const SCHEDULE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Folder names: printable, no quotes/backslashes/slashes, ≤ 100 chars. */
export const FOLDER_NAME_PATTERN = /^[^'"\\/\p{Cc}]{1,100}$/u;

export const DEFAULT_FOLDER_NAME = 'skygalaxy-db-backups';

/** Admin-editable backup settings, stored on the global `Setting` document. */
export interface BackupSettings {
  enabled: boolean;
  backupsPerDay: BackupsPerDay;
  scheduleTime: string;
  retentionDays: RetentionDays;
  googleDrive: {
    folderName: string;
    /** Set by the server once the app-owned folder exists; not admin-editable. */
    folderId: string;
  };
  /** When backups were last switched on (server-managed; the watchdog's baseline). */
  enabledAt?: Date | null;
}

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  enabled: false,
  backupsPerDay: 4,
  scheduleTime: '03:00',
  retentionDays: 14,
  googleDrive: { folderName: DEFAULT_FOLDER_NAME, folderId: '' },
  enabledAt: null,
};

export type BackupTrigger = 'scheduled' | 'manual';

export interface BackupJobData {
  trigger: BackupTrigger;
  requestedBy?: string;
  /** Times the job was postponed because a check/import held the lock. */
  lockWaits?: number;
}

/** What holds the backup lock (stored with its token). */
export type BackupLockPurpose = 'backup' | 'check' | 'import';

/** A job that finds the lock held by a check/import is postponed by this much… */
export const LOCK_WAIT_DELAY_MS = 30_000;
/** …at most this many times (≈ 1 h), then it gives up. */
export const MAX_LOCK_WAITS = 120;

export type BackupJobResult =
  | { skipped: 'locked' | 'disabled' }
  | { runId: string; driveFileId: string; sizeBytes: number }
  | { checkId: string; status: string };

/**
 * Cron pattern for `perDay` evenly spaced runs starting at `time` (local to
 * the scheduler's timezone). 03:00 × 4 → `0 3,9,15,21 * * *`.
 */
export function buildCronPattern(perDay: number, time: string): string {
  if (!(SUPPORTED_BACKUPS_PER_DAY as readonly number[]).includes(perDay)) {
    throw new Error(`Unsupported backups per day: ${perDay}`);
  }
  if (!SCHEDULE_TIME_PATTERN.test(time)) {
    throw new Error(`Invalid schedule time: ${time}`);
  }
  const [hour, minute] = time.split(':').map(Number);
  const interval = 24 / perDay;
  const hours = Array.from(
    { length: perDay },
    (_, k) => (hour + k * interval) % 24,
  ).sort((a, b) => a - b);
  return `${minute} ${hours.join(',')} * * *`;
}

/** Local `HH:mm` run times for a schedule, e.g. ['03:00', '09:00', …]. */
export function scheduleRunTimes(perDay: number, time: string): string[] {
  const [minute, hours] = buildCronPattern(perDay, time).split(' ');
  const mm = minute.padStart(2, '0');
  return hours.split(',').map((h) => `${h.padStart(2, '0')}:${mm}`);
}

/**
 * Strips anything that could be a credential from an error message before it
 * is stored, logged in a run record, returned to the admin UI or emailed:
 * connection strings, bearer/OAuth tokens, `key=`/`token=` parameters.
 */
// Re-exported from shared utility — kept here for backward compatibility.
export { sanitizeError } from '../shared/utils/sanitize-error.util';

// ─── verification, test restore, manual uploads ─────────────────────────────

export const VERIFY_BACKUP_JOB = 'verify-backup';
export const TEST_RESTORE_JOB = 'test-restore';
export const TEST_RESTORE_DEDUP_ID = 'db-backup-test-restore';
export const RESTORE_UPLOADS_JOB = 'restore-uploads';
export const RESTORE_UPLOADS_DEDUP_ID = 'db-backup-restore-uploads';

/**
 * Restoring uploaded files into the live uploads folder:
 * - preview: report only, write nothing;
 * - restore: write missing files, never replace an existing different file;
 * - overwrite: also replace existing files whose content differs.
 */
export const RESTORE_UPLOADS_MODES = [
  'preview',
  'restore',
  'overwrite',
] as const;
export type RestoreUploadsMode = (typeof RESTORE_UPLOADS_MODES)[number];

/** Options for verify / test-restore jobs: wait for a running backup. */
export const CHECK_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'fixed' as const, delay: 30_000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
};

export interface BackupCheckJobData {
  checkId: string;
  fileId: string;
  requestedBy?: string;
  /** restore-uploads jobs only. */
  mode?: RestoreUploadsMode;
  /** Times the job was postponed because the lock was held. */
  lockWaits?: number;
}

/** Temp files of backups uploaded from the panel (ciphertext only). */
export const UPLOAD_TEMP_DIR_NAME = 'sgbk-uploads';
/** Encrypted exports waiting to be uploaded (ciphertext only). */
export const SPOOL_DIR_NAME = 'sgbk-spool';

/** Drive subfolder (inside the backup folder) for backups uploaded from a device. */
export const MANUAL_UPLOADS_FOLDER_NAME = 'manual-uploads';
export const MANUAL_UPLOADS_FOLDER_ROLE = 'manual-uploads';
export const DB_UPLOAD_KIND = 'db-backup-upload';
export const MANIFEST_UPLOAD_KIND = 'uploads-manifest-upload';

/** Drive file ids are URL-safe base64-ish; anything else is rejected early. */
export const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
/** One-time download tokens: 32 random bytes, base64url. */
export const DOWNLOAD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
