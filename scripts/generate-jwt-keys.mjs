/**
 * Generates a fresh ES256 (P-256) key pair for signing access tokens and
 * prints it as ready-to-paste .env lines (PEM on one line with literal \n).
 *
 *   npm run jwt:keys
 *
 * - server/.env  → JWT_PRIVATE_KEY + JWT_PUBLIC_KEY
 * - cleint/.env  → JWT_PUBLIC_KEY only (never the private key, never NEXT_PUBLIC_)
 *
 * Rotating keys invalidates current access tokens; clients recover silently
 * through the refresh flow (refresh tokens are DB-stored UUIDs, not JWTs).
 */
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

// JSON.stringify yields a double-quoted single line with literal \n
const line = (name, pem) => `${name}=${JSON.stringify(pem.trim())}`;
const privateLine = line('JWT_PRIVATE_KEY', privateKey);
const publicLine = line('JWT_PUBLIC_KEY', publicKey);

console.log(`
# ── server/.env (API) ─────────────────────────────────────────
${privateLine}
${publicLine}

# ── cleint/.env (Next.js server) — public key only ────────────
${publicLine}

# Hosting panels: paste the value WITHOUT the surrounding quotes, keep the \\n.
# Keep the private key secret; restart the API and Next.js after updating.
`);
