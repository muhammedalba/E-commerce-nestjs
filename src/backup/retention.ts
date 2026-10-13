import { MIN_BACKUPS_KEPT } from './backup.types';

/** The parts of a Drive file retention looks at. */
export interface RetentionCandidate {
  id: string;
  name: string;
  size?: string | number;
  createdTime?: string;
  appProperties?: Record<string, string>;
}

export const BACKUP_KIND_PROPERTY = 'sgbkKind';
export const BACKUP_KIND_VALUE = 'db-backup';
export const BACKUP_CREATED_AT_PROPERTY = 'sgbkCreatedAt';
/** 'partial' until the backup's uploads manifest is saved too; absent (older files) = complete. */
export const BACKUP_STATUS_PROPERTY = 'sgbkStatus';
/** Outcome of the last verification of the file: 'ok' | 'failed'. */
export const BACKUP_VERIFIED_PROPERTY = 'sgbkVerified';

/** Complete, and not known to fail verification: what retention must keep enough of. */
export function isTrustedBackup(file: RetentionCandidate): boolean {
  return (
    file.appProperties?.[BACKUP_STATUS_PROPERTY] !== 'partial' &&
    file.appProperties?.[BACKUP_VERIFIED_PROPERTY] !== 'failed'
  );
}

/** A file this app uploaded as a backup, with a usable timestamp and size. */
export function isValidBackupFile(file: RetentionCandidate): boolean {
  return (
    file.appProperties?.[BACKUP_KIND_PROPERTY] === BACKUP_KIND_VALUE &&
    Number(file.size) > 0 &&
    backupTimestamp(file) !== null
  );
}

/** Creation time from our own appProperty, falling back to Drive's createdTime. */
export function backupTimestamp(file: RetentionCandidate): number | null {
  const raw =
    file.appProperties?.[BACKUP_CREATED_AT_PROPERTY] ?? file.createdTime;
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Picks which backups to delete. Deterministic and side-effect free:
 * - only valid backup files (see {@link isValidBackupFile}) are ever chosen;
 * - the newest `minKeep` trusted backups (complete, not failed verification)
 *   are always kept, however old; if there are fewer, the newest others fill
 *   up to `minKeep` (never fewer files kept than before this rule);
 * - the newest backup that passed verification is always kept;
 * - `protectId` (the backup just uploaded) is always kept;
 * - everything else older than `retentionDays` is returned, oldest first.
 */
export function selectBackupsToDelete(
  files: RetentionCandidate[],
  now: Date,
  retentionDays: number,
  minKeep = MIN_BACKUPS_KEPT,
  protectId?: string,
): RetentionCandidate[] {
  if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
    throw new Error(`Invalid retention period: ${retentionDays}`);
  }
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;

  const valid = files
    .filter(isValidBackupFile)
    .map((file) => ({ file, at: backupTimestamp(file)! }))
    // newest first; id breaks ties so the order is stable
    .sort((a, b) => b.at - a.at || b.file.id.localeCompare(a.file.id));

  const keep = new Set<string>();
  const want = Math.max(minKeep, 0);
  for (const { file } of valid) {
    if (keep.size >= want) break;
    if (isTrustedBackup(file)) keep.add(file.id);
  }
  for (const { file } of valid) {
    if (keep.size >= want) break;
    keep.add(file.id);
  }
  const lastVerified = valid.find(
    ({ file }) => file.appProperties?.[BACKUP_VERIFIED_PROPERTY] === 'ok',
  );
  if (lastVerified) keep.add(lastVerified.file.id);
  if (protectId) keep.add(protectId);

  return valid
    .filter(({ file, at }) => at < cutoff && !keep.has(file.id))
    .reverse()
    .map(({ file }) => file);
}
