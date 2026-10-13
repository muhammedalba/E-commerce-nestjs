/** Page size used when the request does not ask for one. */
export const DEFAULT_PAGE_LIMIT = 15;

/**
 * Largest page size a client may request. Kept at 500 because the Next.js
 * sitemap fetches products 500 at a time (it follows `nextPage`, so a lower
 * cap would still work, only with more requests).
 */
export const MAX_PAGE_LIMIT = 500;

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const value = parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value >= 1 ? value : fallback;
}

/**
 * Parses `page` / `limit` from the query string. Missing or invalid values
 * fall back to the defaults and `limit` is capped at MAX_PAGE_LIMIT, so
 * `?limit=100000` cannot load a whole collection in one request, and
 * `?page=0` or `?limit=abc` never reach MongoDB as a negative skip or NaN.
 */
export function parsePagination(
  page: string | undefined,
  limit: string | undefined,
  defaultLimit = DEFAULT_PAGE_LIMIT,
) {
  const safePage = toPositiveInt(page, 1);
  const safeLimit = Math.min(
    toPositiveInt(limit, defaultLimit),
    MAX_PAGE_LIMIT,
  );
  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}
