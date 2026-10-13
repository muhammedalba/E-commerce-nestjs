/**
 * Restores the backed-up uploads folder (images, attachments) from Google Drive.
 *
 *   npm run build                                  # once: uses the compiled code
 *   npm run backup:restore-uploads -- --list       # available backups, newest first
 *   npm run backup:restore-uploads -- --target ./uploads [--backup <id>|latest]
 *                                     [--folder <drive folder>] [--overwrite] [--dry-run]
 *   npm run backup:restore-uploads -- --from-bundle ./skygalaxy-<id>.backup.tar --target ./uploads
 *                                     (offline: no Google Drive access needed)
 *
 * Needs (env or server/.env): GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET,
 * GDRIVE_REFRESH_TOKEN, BACKUP_ENCRYPTION_KEY (+ BACKUP_DECRYPTION_KEYS for
 * backups made before a key rotation). Folder: --folder, else
 * BACKUP_FOLDER_NAME, else "skygalaxy-db-backups".
 *
 * - Use the same backup id as the database restore so files match the data.
 * - Every file is decrypted and verified before it is written; existing files
 *   with identical content are kept; different existing files are reported as
 *   conflicts and only replaced with --overwrite.
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const dist = (p) => fileURLToPath(new URL(`../dist/src/backup/${p}`, import.meta.url));

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    'Usage: npm run backup:restore-uploads -- (--list | --target <dir>) [--backup <id>|latest] [--folder <name>] [--overwrite] [--dry-run]',
  );
  process.exit(2);
}

const args = process.argv.slice(2);
const flags = { list: false, overwrite: false, dryRun: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--list') flags.list = true;
  else if (a === '--overwrite') flags.overwrite = true;
  else if (a === '--dry-run') flags.dryRun = true;
  else if (a === '--target') flags.target = args[++i];
  else if (a === '--backup') flags.backup = args[++i];
  else if (a === '--folder') flags.folder = args[++i];
  else if (a === '--from-bundle') flags.bundle = args[++i];
  else usage(`unknown argument ${a}`);
}
if (!flags.list && !flags.target) usage('--target <dir> is required');
if (flags.bundle && (flags.list || flags.backup || flags.folder)) {
  usage('--from-bundle cannot be combined with --list, --backup or --folder');
}
if (flags.bundle && !existsSync(flags.bundle)) usage(`file not found: ${flags.bundle}`);

const compiled = dist('uploads/restore-uploads.js');
if (!existsSync(compiled)) {
  console.error('Compiled code not found. Run `npm run build` first.');
  process.exit(1);
}
const {
  restoreUploads,
  listUploadsBackups,
  findDriveUploadsSource,
  bundleUploadsSource,
} = require(compiled);
const { GoogleDriveClient } = require(dist('google-drive.client.js'));
const { keysFromEnv } = require(dist('restore.js'));

const log = (m) => console.log(m);
const report = (r) => log(`Done: ${r.files} files in backup ${r.backupId}.`);
const fail = (err) => {
  console.error(`Uploads restore failed: ${err?.message ?? err}`);
  for (const p of err?.report?.missing ?? []) console.error(`  missing:  ${p}`);
  for (const p of err?.report?.conflicts ?? []) console.error(`  conflict: ${p}`);
  for (const p of err?.report?.failed ?? []) console.error(`  failed:   ${p}`);
  process.exit(1);
};
const restoreOpts = () => ({
  keys: keysFromEnv(process.env),
  targetDir: flags.target,
  overwrite: flags.overwrite,
  dryRun: flags.dryRun,
  log,
});

if (flags.bundle) {
  try {
    report(
      await restoreUploads({
        ...restoreOpts(),
        source: await bundleUploadsSource(flags.bundle),
      }),
    );
    process.exit(0);
  } catch (err) {
    fail(err);
  }
}

const creds = {
  clientId: process.env.GDRIVE_CLIENT_ID ?? '',
  clientSecret: process.env.GDRIVE_CLIENT_SECRET ?? '',
  refreshToken: process.env.GDRIVE_REFRESH_TOKEN ?? '',
};
const missing = Object.entries(creds)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`Missing Google Drive credentials: ${missing.join(', ')}`);
  process.exit(1);
}
const drive = GoogleDriveClient.fromOAuth(creds);
const folderName =
  flags.folder || process.env.BACKUP_FOLDER_NAME || 'skygalaxy-db-backups';

try {
  if (flags.list) {
    const backups = await listUploadsBackups(drive, folderName);
    if (!backups.length) log('No uploads backups found.');
    for (const b of backups) log(`${b.backupId}   ${b.createdAt ?? ''}`);
    process.exit(0);
  }
  report(
    await restoreUploads({
      ...restoreOpts(),
      source: await findDriveUploadsSource(drive, folderName, flags.backup ?? 'latest'),
    }),
  );
} catch (err) {
  fail(err);
}
