import { timingSafeEqual } from 'crypto';

/** Header the Next.js server sends with the shared INTERNAL_API_KEY. */
export const INTERNAL_KEY_HEADER = 'x-internal-key';

type HeaderBag = { headers: Record<string, string | string[] | undefined> };

let cachedKey: Buffer | null | undefined;

function internalKey(): Buffer | null {
  if (cachedKey === undefined) {
    cachedKey = process.env.INTERNAL_API_KEY
      ? Buffer.from(process.env.INTERNAL_API_KEY)
      : null;
  }
  return cachedKey;
}

/**
 * True when the request carries the shared INTERNAL_API_KEY, i.e. it comes
 * from the Next.js server (its own fetches or a relayed browser request).
 * Always false when INTERNAL_API_KEY is not set.
 */
export function hasValidInternalKey(req: HeaderBag): boolean {
  const key = internalKey();
  if (!key) return false;
  const header = req.headers[INTERNAL_KEY_HEADER];
  if (typeof header !== 'string') return false;

  const provided = Buffer.from(header);
  // timingSafeEqual throws on length mismatch, so compare lengths first
  return provided.length === key.length && timingSafeEqual(provided, key);
}

/** Test hook: re-read INTERNAL_API_KEY on the next check. */
export function resetInternalKey(): void {
  cachedKey = undefined;
}
