import {
  getAllCountries,
  getCountry,
  getTimezone,
} from 'countries-and-timezones';

/**
 * - `store-address`: the address pins one zone (single-zone country, or the
 *   city matched a zone of a multi-zone country);
 * - `country-default`: multi-zone country, city not matched → main zone;
 * - `fallback`: the address could not be resolved → server fallback zone.
 */
export type TimezoneSource = 'store-address' | 'country-default' | 'fallback';

export interface ResolvedTimezone {
  timezone: string;
  source: TimezoneSource;
  countryCode: string | null;
}

export interface StoreAddressInput {
  country?: { ar?: string; en?: string } | null;
  city?: { ar?: string; en?: string } | null;
}

/** Main zone of multi-zone countries (the package lists zones alphabetically). */
const PRIMARY_ZONE: Record<string, string> = {
  US: 'America/New_York',
  CA: 'America/Toronto',
  MX: 'America/Mexico_City',
  BR: 'America/Sao_Paulo',
  AR: 'America/Argentina/Buenos_Aires',
  CL: 'America/Santiago',
  EC: 'America/Guayaquil',
  RU: 'Europe/Moscow',
  UA: 'Europe/Kyiv',
  KZ: 'Asia/Almaty',
  CN: 'Asia/Shanghai',
  MN: 'Asia/Ulaanbaatar',
  ID: 'Asia/Jakarta',
  MY: 'Asia/Kuala_Lumpur',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  ES: 'Europe/Madrid',
  PT: 'Europe/Lisbon',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  GB: 'Europe/London',
  CD: 'Africa/Kinshasa',
  UZ: 'Asia/Tashkent',
  CY: 'Asia/Nicosia',
  PS: 'Asia/Gaza',
};

/** Common short names that Intl region names do not cover. */
const ALIASES: Record<string, string> = {
  ksa: 'SA',
  'saudi arabia': 'SA',
  السعوديه: 'SA',
  'المملكه العربيه السعوديه': 'SA',
  uae: 'AE',
  الامارات: 'AE',
  'الامارات العربيه المتحده': 'AE',
  usa: 'US',
  us: 'US',
  'united states of america': 'US',
  امريكا: 'US',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  بريطانيا: 'GB',
  مصر: 'EG',
  الكويت: 'KW',
  قطر: 'QA',
  البحرين: 'BH',
  عمان: 'OM',
  'سلطنه عمان': 'OM',
  الاردن: 'JO',
  المانيا: 'DE',
};

/** Lowercase, strip diacritics/punctuation, unify Arabic letter variants. */
export function normalizePlaceName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // Latin diacritics
    .replace(/[ً-ٰٟـ]/g, '') // Arabic harakat, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/^the /, '')
    .trim();
}

let nameIndex: Map<string, string> | null = null;

/** name (normalized, en/ar/package name/ISO code) → ISO 3166-1 alpha-2. */
function countryNameIndex(): Map<string, string> {
  if (nameIndex) return nameIndex;
  const index = new Map<string, string>();
  const display = (['en', 'ar'] as const).map(
    (lang) => new Intl.DisplayNames([lang], { type: 'region' }),
  );
  for (const country of Object.values(getAllCountries())) {
    const names = [country.id, country.name];
    for (const d of display) {
      try {
        const n = d.of(country.id);
        if (n && n !== country.id) names.push(n);
      } catch {
        /* unknown region for this ICU build */
      }
    }
    for (const n of names) {
      const key = normalizePlaceName(n);
      if (key && !index.has(key)) index.set(key, country.id);
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) {
    index.set(normalizePlaceName(alias), code);
  }
  nameIndex = index;
  return index;
}

/** Resolves a free-text country name (Arabic or English) or ISO code. */
export function resolveCountryCode(
  names: (string | undefined | null)[],
): string | null {
  const index = countryNameIndex();
  for (const name of names) {
    if (!name?.trim()) continue;
    const upper = name.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(upper) && getCountry(upper)) return upper;
    const code = index.get(normalizePlaceName(name));
    if (code) return code;
  }
  return null;
}

function zoneCity(zone: string): string {
  return normalizePlaceName(zone.split('/').pop()!.replace(/_/g, ' '));
}

/** True for an IANA zone the runtime (and therefore the scheduler) accepts. */
export function isValidTimeZone(zone: string | undefined): boolean {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Main zone of a country: override, else a zone primarily of this country. */
function primaryZone(code: string, zones: string[]): string {
  if (PRIMARY_ZONE[code] && zones.includes(PRIMARY_ZONE[code])) {
    return PRIMARY_ZONE[code];
  }
  const own = zones.find((z) => getTimezone(z)?.countries?.[0] === code);
  return own ?? zones[0];
}

/**
 * Derives the backup scheduler's timezone from the store owner's address
 * (Settings → contact → business address).
 *
 * @param address    `businessAddress` from the settings document.
 * @param fallback   Zone used when the country cannot be resolved.
 * @param knownCode  ISO code already matched (e.g. via the Country collection).
 */
export function resolveStoreTimezone(
  address: StoreAddressInput | null | undefined,
  fallback: string,
  knownCode?: string | null,
): ResolvedTimezone {
  const fallbackResult: ResolvedTimezone = {
    timezone: fallback,
    source: 'fallback',
    countryCode: null,
  };
  const code =
    (knownCode && getCountry(knownCode.toUpperCase())
      ? knownCode.toUpperCase()
      : null) ??
    resolveCountryCode([address?.country?.en, address?.country?.ar]);
  if (!code) return fallbackResult;

  const zones = (getCountry(code)?.timezones ?? []).filter(isValidTimeZone);
  if (zones.length === 0) return fallbackResult;
  if (zones.length === 1) {
    return { timezone: zones[0], source: 'store-address', countryCode: code };
  }

  const cities = [address?.city?.en, address?.city?.ar]
    .filter((c): c is string => !!c?.trim())
    .map(normalizePlaceName);
  const byCity = zones.find((z) => cities.includes(zoneCity(z)));
  if (byCity) {
    return { timezone: byCity, source: 'store-address', countryCode: code };
  }
  return {
    timezone: primaryZone(code, zones),
    source: 'country-default',
    countryCode: code,
  };
}
