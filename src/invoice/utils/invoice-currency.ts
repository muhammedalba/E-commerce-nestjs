import { currencyDecimals } from 'src/payments/shared/utils/currency.util';

/**
 * Money on the invoice, formatted like the client's formatCurrency for the
 * Arabic locale (cleint/lib/currency.ts): the store's base currency, Latin
 * digits, no decimals for whole amounts and 2 otherwise, and the symbol from
 * the client's currency list (cleint/shared/constants/currencies.ts).
 * Keep both in sync.
 */

type SymbolPosition = 'before' | 'after';

const CURRENCY_SYMBOLS: Record<
  string,
  { symbol: string; position: SymbolPosition }
> = {
  USD: { symbol: '$', position: 'before' },
  SAR: { symbol: '⃁', position: 'after' },
  AED: { symbol: 'د.إ', position: 'after' },
  KWD: { symbol: 'د.ك', position: 'after' },
  QAR: { symbol: 'ر.ق', position: 'after' },
  BHD: { symbol: '.د.ب', position: 'after' },
  OMR: { symbol: 'ر.ع.', position: 'after' },
  EGP: { symbol: 'ج.م', position: 'after' },
  JOD: { symbol: 'د.أ', position: 'after' },
  IQD: { symbol: 'ع.د', position: 'after' },
  EUR: { symbol: '€', position: 'before' },
  GBP: { symbol: '£', position: 'before' },
  TRY: { symbol: '₺', position: 'after' },
  MAD: { symbol: 'د.م.', position: 'after' },
  DZD: { symbol: 'د.ج', position: 'after' },
  TND: { symbol: 'د.ت', position: 'after' },
  LYD: { symbol: 'ل.د', position: 'after' },
  YER: { symbol: 'ر.ي', position: 'after' },
  LBP: { symbol: 'ل.ل', position: 'after' },
  SYP: { symbol: 'ل.س', position: 'after' },
  AUD: { symbol: '$', position: 'before' },
};

/**
 * `amount` in the store currency, e.g. 1234.5 → "1,234.50 ⃁", 10 → "10 ⃁".
 * An unknown code is shown as itself after the number, like the client.
 */
export function formatInvoiceCurrency(
  amount: number,
  currencyCode?: string | null,
): string {
  const value = Number(amount) || 0;
  const code = currencyCode || 'SAR';
  // The currency's own decimals: 2 for SAR, 3 for KWD (fils), 0 for JPY
  const decimals = currencyDecimals(code);
  const digits = Number.isInteger(value) ? 0 : decimals;
  const formatted = new Intl.NumberFormat('ar-SA-u-nu-latn', {
    minimumFractionDigits: digits,
    maximumFractionDigits: decimals,
  }).format(value);

  const { symbol, position } = CURRENCY_SYMBOLS[code] ?? {
    symbol: code,
    position: 'after',
  };
  return position === 'before'
    ? `${symbol} ${formatted}`
    : `${formatted} ${symbol}`;
}
