import * as crypto from 'crypto';

/** Shape of the raw refresh tokens issued by `TokenService` (UUID v4). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Hashes a raw refresh token for storage and lookup.
 *
 * @security Only the SHA-256 hash is persisted, so a database dump cannot be
 * replayed as a refresh token. A salt or slow hash is unnecessary: the raw
 * token is a random UUID v4 (122 bits of entropy), and a deterministic hash is
 * what allows the token to be found with a single indexed query.
 */
export const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Values a presented refresh token may be stored under.
 *
 * @description Always includes the hash. A UUID-shaped token also matches its
 * plaintext form, so sessions issued before hashing was introduced keep
 * working until they rotate (rotation stores a hash) or expire via the TTL
 * index. Hashes are 64 hex chars, never UUID-shaped, so a hash taken from a
 * database dump can never match itself through this fallback.
 */
export const refreshTokenLookupValues = (token: string): string[] =>
  UUID_PATTERN.test(token)
    ? [hashRefreshToken(token), token]
    : [hashRefreshToken(token)];
