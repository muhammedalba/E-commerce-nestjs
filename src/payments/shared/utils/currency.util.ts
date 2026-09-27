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

/** Converts a major-unit amount (e.g. 100.5 SAR) to Moyasar's integer minor units. */
export function toMinorUnits(amount: number, currency: string): number {
  const code = normalizeCurrency(currency);
  const factor = THREE_DECIMAL_CURRENCIES.has(code)
    ? 1000
    : ZERO_DECIMAL_CURRENCIES.has(code)
      ? 1
      : 100;
  return Math.round(amount * factor);
}
