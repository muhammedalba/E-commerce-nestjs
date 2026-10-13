/**
 * Generates a backup encryption key (32 random bytes, base64) and prints it
 * as a ready-to-paste .env line.
 *
 *   npm run backup:keygen
 *
 * - server/.env → BACKUP_ENCRYPTION_KEY
 * - ALSO store it outside the server and outside Google Drive (password
 *   manager / secrets vault). Backups encrypted with a lost key cannot be
 *   restored by anyone.
 * - Rotating: keep the old key in BACKUP_DECRYPTION_KEYS (comma-separated)
 *   wherever you restore, so older backups stay readable.
 */
import { createHash, randomBytes } from 'node:crypto';

const key = randomBytes(32);
const keyId = createHash('sha256').update(key).digest('hex').slice(0, 16);

console.log(`
# ── server/.env (API) ─────────────────────────────────────────
BACKUP_ENCRYPTION_KEY=${key.toString('base64')}

# keyId ${keyId} — written into each backup header so restore can pick the key.
# Save this key in a password manager NOW. Without it backups are unrecoverable.
# Restart the API after updating.
`);
