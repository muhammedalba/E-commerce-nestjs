import {
  isValidTimeZone,
  normalizePlaceName,
  resolveCountryCode,
  resolveStoreTimezone,
} from './store-timezone';

const FALLBACK = 'Asia/Riyadh';
const address = (country: string, city = '', countryAr = '', cityAr = '') => ({
  country: { en: country, ar: countryAr },
  city: { en: city, ar: cityAr },
});

describe('resolveStoreTimezone', () => {
  it('derives Asia/Riyadh from the seeded Saudi address (English and Arabic)', () => {
    expect(
      resolveStoreTimezone(address('Saudi Arabia', 'Riyadh'), 'UTC'),
    ).toEqual({
      timezone: 'Asia/Riyadh',
      source: 'store-address',
      countryCode: 'SA',
    });
    expect(
      resolveStoreTimezone(
        address('', '', 'المملكة العربية السعودية', 'الرياض'),
        'UTC',
      ),
    ).toMatchObject({ timezone: 'Asia/Riyadh', source: 'store-address' });
    expect(
      resolveStoreTimezone(address('', '', 'السعودية'), 'UTC').timezone,
    ).toBe('Asia/Riyadh');
    expect(resolveStoreTimezone(address('KSA'), 'UTC').timezone).toBe(
      'Asia/Riyadh',
    );
  });

  it('handles other single-zone countries and ISO codes', () => {
    expect(resolveStoreTimezone(address('Egypt'), FALLBACK).timezone).toBe(
      'Africa/Cairo',
    );
    expect(
      resolveStoreTimezone(address('', '', 'الإمارات'), FALLBACK).timezone,
    ).toBe('Asia/Dubai');
    expect(resolveStoreTimezone(address('AE'), FALLBACK).timezone).toBe(
      'Asia/Dubai',
    );
  });

  it('uses the main zone of a country with several zones', () => {
    expect(
      resolveStoreTimezone(address('Germany', 'Hamburg'), FALLBACK),
    ).toEqual({
      timezone: 'Europe/Berlin',
      source: 'country-default',
      countryCode: 'DE',
    });
    expect(resolveStoreTimezone(address('ألمانيا'), FALLBACK).timezone).toBe(
      'Europe/Berlin',
    );
  });

  it('matches the city against the zones of a multi-zone country', () => {
    expect(
      resolveStoreTimezone(address('United States', 'New York'), FALLBACK),
    ).toEqual({
      timezone: 'America/New_York',
      source: 'store-address',
      countryCode: 'US',
    });
    expect(
      resolveStoreTimezone(address('United States', 'Los Angeles'), FALLBACK)
        .timezone,
    ).toBe('America/Los_Angeles');
    expect(
      resolveStoreTimezone(address('USA', 'Springfield'), FALLBACK),
    ).toMatchObject({
      timezone: 'America/New_York',
      source: 'country-default',
    });
  });

  it('prefers a code already matched through the Country collection', () => {
    expect(
      resolveStoreTimezone(address('Some custom name'), FALLBACK, 'eg'),
    ).toEqual({
      timezone: 'Africa/Cairo',
      source: 'store-address',
      countryCode: 'EG',
    });
  });

  it('falls back when the address cannot be resolved', () => {
    const fb = { timezone: FALLBACK, source: 'fallback', countryCode: null };
    expect(resolveStoreTimezone(null, FALLBACK)).toEqual(fb);
    expect(resolveStoreTimezone(address(''), FALLBACK)).toEqual(fb);
    expect(resolveStoreTimezone(address('Atlantis'), FALLBACK)).toEqual(fb);
  });
});

describe('helpers', () => {
  it('normalizes Arabic letter variants and diacritics', () => {
    expect(normalizePlaceName('  المملكة العربية السعودية ')).toBe(
      normalizePlaceName('المملكه العربيه السعوديه'),
    );
    expect(normalizePlaceName('São Paulo')).toBe('sao paulo');
    expect(normalizePlaceName('The Netherlands')).toBe('netherlands');
  });

  it('resolves country codes from any of several names', () => {
    expect(resolveCountryCode([undefined, '', 'Kuwait'])).toBe('KW');
    expect(resolveCountryCode(['nowhere'])).toBeNull();
  });

  it('validates IANA zones', () => {
    expect(isValidTimeZone('Asia/Riyadh')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});
