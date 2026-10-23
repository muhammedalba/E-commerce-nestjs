import {
  hashRefreshToken,
  refreshTokenLookupValues,
} from './refresh-token-hash.util';

describe('refresh token hashing', () => {
  const rawToken = '3f2b8c1e-9d4a-4e6b-8f7c-2a1d5e9b0c34';

  it('produces a deterministic SHA-256 hex hash that differs from the raw token', () => {
    const hash = hashRefreshToken(rawToken);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashRefreshToken(rawToken));
    expect(hash).not.toBe(rawToken);
  });

  it('looks a UUID token up by its hash and its legacy plaintext form', () => {
    expect(refreshTokenLookupValues(rawToken)).toEqual([
      hashRefreshToken(rawToken),
      rawToken,
    ]);
  });

  it('never lets a stored hash (e.g. from a DB dump) match itself', () => {
    const storedHash = hashRefreshToken(rawToken);

    expect(refreshTokenLookupValues(storedHash)).toEqual([
      hashRefreshToken(storedHash),
    ]);
    expect(refreshTokenLookupValues(storedHash)).not.toContain(storedHash);
  });
});
