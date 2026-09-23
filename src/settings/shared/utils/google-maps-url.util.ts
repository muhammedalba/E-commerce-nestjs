/** Google Place IDs are URL-safe tokens (e.g. `ChIJN1t_tDeuEmsRUsoyG83frY4`). */
export const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Hosts we are willing to request while expanding a Google Maps link.
 * Restricting this prevents the resolver from being used for SSRF.
 */
const GOOGLE_HOST_PATTERN =
  /(^|\.)(google\.[a-z]{2,3}(\.[a-z]{2})?|goo\.gl|g\.page|g\.co)$/i;

export function isGoogleHost(hostname: string): boolean {
  return GOOGLE_HOST_PATTERN.test(hostname);
}

export interface ParsedGoogleMapsUrl {
  /** Present when the link already carries a Place ID. */
  placeId?: string;
  /** Business name taken from `/maps/place/{name}/` or the `q` param. */
  name?: string;
  lat?: number;
  lng?: number;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value.replace(/\+/g, ' ');
  }
}

/**
 * Extracts whatever is needed to identify a place from a full Google Maps URL.
 *
 * Supported forms:
 * - `...?placeid=ChIJ...` / `?place_id=` / `?query_place_id=` / `?q=place_id:ChIJ...`
 * - `/maps/place/{name}/@{lat},{lng},...` (+ precise `!3d{lat}!4d{lng}` in `data=`)
 * - `?q={name}` search links
 *
 * Short links (`maps.app.goo.gl`, `g.page`) must be expanded first.
 */
export function parseGoogleMapsUrl(raw: string): ParsedGoogleMapsUrl {
  const url = new URL(raw);
  const params = url.searchParams;

  const q = params.get('q') || params.get('query') || '';
  const directId =
    params.get('placeid') ||
    params.get('place_id') ||
    params.get('query_place_id') ||
    /place_id:([A-Za-z0-9_-]+)/.exec(q)?.[1];

  if (directId && PLACE_ID_PATTERN.test(directId)) {
    return { placeId: directId };
  }

  const placeName = /\/maps\/place\/([^/]+)/.exec(url.pathname)?.[1];
  const name = (placeName ? safeDecode(placeName) : q).trim() || undefined;

  // Prefer the pin coordinates (!3d/!4d) over the viewport centre (@lat,lng)
  const coords =
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(raw) ??
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(raw);

  return {
    name,
    lat: coords ? Number(coords[1]) : undefined,
    lng: coords ? Number(coords[2]) : undefined,
  };
}

/** True once a URL contains enough information to be parsed without redirects. */
export function isExpandedGoogleMapsUrl(raw: string): boolean {
  return /\/maps\/place\/|[?&](placeid|place_id|query_place_id|q|query)=/.test(
    raw,
  );
}
