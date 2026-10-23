/**
 * Moyasar amounts are integers in the currency's smallest unit (ISO 4217
 * minor units): 100 halalas = 1 SAR, but 1000 fils = 1 KWD and 1 JPY = 1 JPY.
 * Must stay in sync with the checkout page (cleint/features/checkout/utils/currency.ts).
 */
const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD',
  'IQD',
  'JOD',
  'KWD',
  'LYD',
  'OMR',
  'TND',
]);
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

/**
 * Normalizes a currency code exactly like the checkout page does before it
 * calls Moyasar.init, so a store currency set as 'ر.س' or 'sar' still matches
 * the 'SAR' Moyasar reports.
 */
export function normalizeCurrency(currency: unknown): string {
  const code = (typeof currency === 'string' ? currency : '')
    .toUpperCase()
    .trim();
  return code === 'ر.س' || code === 'ر.س.' ? 'SAR' : code;
}

function minorUnitFactor(currency: string): number {
  const code = normalizeCurrency(currency);
  return THREE_DECIMAL_CURRENCIES.has(code)
    ? 1000
    : ZERO_DECIMAL_CURRENCIES.has(code)
      ? 1
      : 100;
}

/** Converts a major-unit amount (e.g. 100.5 SAR) to Moyasar's integer minor units. */
export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * minorUnitFactor(currency));
}

/** Converts Moyasar's integer minor units back to a major-unit amount. */
export function fromMinorUnits(minorUnits: number, currency: string): number {
  return minorUnits / minorUnitFactor(currency);
}

/** How many decimals the currency has: 2, 3 (KWD, BHD, …) or 0 (JPY, …). */
export function currencyDecimals(currency?: string | null): number {
  return Math.round(Math.log10(minorUnitFactor(currency || 'SAR')));
}

/**
 * An amount rounded to the currency's smallest unit: the halala (2 decimals)
 * for SAR, the fils (3) for KWD, whole yen for JPY. Every money computation
 * (prices, VAT, coupon shares, fees, credit notes) rounds through it, so a
 * three-decimal currency keeps its fils. Without a currency: 2 decimals, as
 * before (the same Math.round the amounts always used).
 */
export function roundMoney(value: number, currency?: string | null): number {
  const factor = minorUnitFactor(currency || 'SAR');
  return Math.round((Number(value) || 0) * factor) / factor;
}

/**
 * Float noise removed from a sum or difference of amounts that are already
 * rounded (to 3 decimals: no currency has more), whatever their currency:
 * 0.1 + 0.2 → 0.3, and 345.123 KWD stays 345.123. Not for computing an
 * amount (a VAT, a share): that is roundMoney, in the amount's currency.
 */
export function cleanMoney(value: number): number {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}
