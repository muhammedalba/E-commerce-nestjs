/**
 * Restores an encrypted SGBK backup into a separate MongoDB database.
 *
 *   npm run build                       # once: the script uses the compiled restore code
 *   npm run backup:restore -- <backup-file> <target-mongodb-uri> [--db <name>]
 *                                [--drop --confirm <name> [--overwrite-live]] [--verify-only]
 *
 * - <backup-file> is a `.sgbk` database file (e.g. from the Google Drive folder)
 *   or a `.backup.tar` bundle downloaded from Admin > Backups (its database
 *   entry is used; restore its uploaded files with backup:restore-uploads --from-bundle).
 * - Keys: BACKUP_ENCRYPTION_KEY, plus BACKUP_DECRYPTION_KEYS (comma-separated)
 *   for backups made before a key rotation — from the environment or server/.env.
 * - The database name comes from --db, else from the URI path; one is required.
 * - The whole file is verified (authenticity, completeness) before anything
 *   is written. A non-empty target is refused unless --drop --confirm <name>.
 *   Restoring over the production database (MONGODB_URI cluster + source db
 *   or MONGODB_DB_NAME) is always refused, and --drop refuses any database an
 *   API instance has run on (live marker) unless --overwrite-live is added.
 * - The target URI is never printed.
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const compiled = fileURLToPath(
  new URL('../dist/src/backup/restore.js', import.meta.url),
);

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    'Usage: npm run backup:restore -- <backup-file> <target-mongodb-uri> [--db <name>] [--drop --confirm <name> [--overwrite-live]] [--verify-only]',
  );
  process.exit(2);
}

const args = process.argv.slice(2);
const positional = [];
const flags = {
  drop: false,
  overwriteLive: false,
  verifyOnly: false,
  db: undefined,
  confirm: undefined,
};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--drop') flags.drop = true;
  else if (a === '--overwrite-live') flags.overwriteLive = true;
  else if (a === '--verify-only') flags.verifyOnly = true;
  else if (a === '--db') flags.db = args[++i];
  else if (a === '--confirm') flags.confirm = args[++i];
  else if (a.startsWith('--')) usage(`unknown option ${a}`);
  else positional.push(a);
}

const [file, targetUri] = positional;
if (!file) usage('backup file is required');
if (!existsSync(file)) usage(`file not found: ${file}`);
if (!existsSync(compiled)) {
  console.error('Compiled restore code not found. Run `npm run build` first.');
  process.exit(1);
}

const { keysFromEnv, restoreBackup, uriDatabase, verifyBackupFile } = require(
  compiled,
);

const log = (m) => console.log(m);

try {
  const keys = keysFromEnv(process.env);

  if (flags.verifyOnly) {
    const v = await verifyBackupFile(file, keys);
    log(
      `OK: backup ${v.header.backupId} from "${v.header.sourceDb}" created ${v.header.createdAt}, ` +
        `${Object.keys(v.counts).length} collections, ${v.end.totalDocs} documents, consistency=${v.begin.consistency}`,
    );
    for (const [name, n] of Object.entries(v.counts)) log(`  ${name}: ${n}`);
    process.exit(0);
  }

  if (!targetUri)
    usage('target MongoDB URI is required (or use --verify-only)');
  const dbName = flags.db ?? uriDatabase(targetUri);
  if (!dbName)
    usage(
      'target database name is required (--db <name> or a /<name> path in the URI)',
    );

  const report = await restoreBackup({
    file,
    targetUri,
    dbName,
    keys,
    drop: flags.drop,
    confirmDbName: flags.confirm,
    sourceUri: process.env.MONGODB_URI,
    liveDbName: process.env.MONGODB_DB_NAME || 'skyGalaxy',
    overwriteLive: flags.overwriteLive,
    log,
  });
  log('\nCollection            expected  restored');
  for (const [name, c] of Object.entries(report.collections)) {
    log(
      `${name.padEnd(22)}${String(c.expected).padStart(8)}  ${String(c.restored).padStart(8)}`,
    );
  }
  if (report.views.length) log(`Views: ${report.views.join(', ')}`);
} catch (err) {
  console.error(`Restore failed: ${err?.message ?? err}`);
  process.exit(1);
}
