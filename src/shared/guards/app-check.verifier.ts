import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createPublicKey, JsonWebKey } from 'crypto';

const JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';
const ISSUER_PREFIX = 'https://firebaseappcheck.googleapis.com/';
const FETCH_TIMEOUT_MS = 5000;
// Firebase asks verifiers not to cache its keys for more than 6 hours; an
// unknown key id refreshes sooner, but at most once a minute.
const KEYS_TTL_MS = 6 * 60 * 60 * 1000;
const KEYS_MIN_REFETCH_MS = 60 * 1000;

/**
 * - `valid`: signed by Firebase for this project (and an allowed app).
 * - `invalid`: forged, expired, or issued for another project / app.
 * - `unavailable`: Firebase's keys could not be fetched and none is cached.
 */
export type AppCheckResult = 'valid' | 'invalid' | 'unavailable';

const logger = new Logger('AppCheckVerifier');
const jwtService = new JwtService();
/** Firebase's public signing keys (PEM) by key id. */
let keys = new Map<string, string>();
let keysFetchedAt = 0;

/** App Check is on once FIREBASE_PROJECT_NUMBER is set. */
export function isAppCheckEnabled(): boolean {
  return !!process.env.FIREBASE_PROJECT_NUMBER?.trim();
}

/**
 * Verifies a Firebase App Check token sent by the mobile app.
 *
 * @description Checks the RS256 signature against Firebase's published keys,
 * the issuer and audience (FIREBASE_PROJECT_NUMBER), the expiry, and — when
 * FIREBASE_APP_IDS is set — that the token was issued to one of those apps.
 * See https://firebase.google.com/docs/app-check/custom-resource-backend
 */
export async function verifyAppCheckToken(
  token: string,
): Promise<AppCheckResult> {
  const projectNumber = process.env.FIREBASE_PROJECT_NUMBER?.trim();
  if (!projectNumber) return 'invalid';

  const decoded = jwtService.decode<{
    header?: { kid?: string; alg?: string; typ?: string };
  } | null>(token, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid || decoded?.header?.typ !== 'JWT') return 'invalid';

  let publicKey: string | undefined;
  try {
    publicKey = await getPublicKey(kid);
  } catch {
    return 'unavailable';
  }
  if (!publicKey) return 'invalid';

  let payload: { sub?: string };
  try {
    payload = await jwtService.verifyAsync<{ sub?: string }>(token, {
      publicKey,
      algorithms: ['RS256'],
      issuer: `${ISSUER_PREFIX}${projectNumber}`,
      audience: `projects/${projectNumber}`,
    });
  } catch (err) {
    logger.warn(`App Check token rejected: ${String(err)}`);
    return 'invalid';
  }

  const appIds = (process.env.FIREBASE_APP_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (appIds.length && !appIds.includes(payload.sub ?? '')) {
    logger.warn(`App Check token rejected: unknown app ${payload.sub}`);
    return 'invalid';
  }
  return 'valid';
}

/**
 * Firebase's public key (PEM) for `kid`, refreshing the cached key set as
 * needed. Throws only when the keys can't be fetched and `kid` isn't cached.
 */
async function getPublicKey(kid: string): Promise<string | undefined> {
  const age = Date.now() - keysFetchedAt;
  if (age > KEYS_TTL_MS || (!keys.has(kid) && age > KEYS_MIN_REFETCH_MS)) {
    try {
      await refreshKeys();
    } catch (err) {
      logger.error(`App Check signing keys unavailable: ${String(err)}`);
      // A stale but known key still verifies; only fail without one.
      if (!keys.has(kid)) throw err;
    }
  }
  return keys.get(kid);
}

async function refreshKeys(): Promise<void> {
  const res = await fetch(JWKS_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as {
    keys?: (JsonWebKey & { kid?: string })[];
  };
  const pems = new Map<string, string>();
  for (const jwk of body.keys ?? []) {
    if (!jwk.kid) continue;
    pems.set(
      jwk.kid,
      createPublicKey({ key: jwk, format: 'jwk' })
        .export({ type: 'spki', format: 'pem' })
        .toString(),
    );
  }
  keys = pems;
  keysFetchedAt = Date.now();
}

/** Test hook: forget the cached keys. */
export function resetAppCheckKeys(): void {
  keys = new Map();
  keysFetchedAt = 0;
}
