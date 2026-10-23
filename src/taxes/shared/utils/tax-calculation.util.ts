import { currencyDecimals } from 'src/payments/shared/utils/currency.util';

/**
 * Rounded to the currency's smallest unit (2 decimals for SAR, 3 for KWD…;
 * without a currency: 2), with toFixed as VAT always was.
 */
const roundTax = (value: number, currency?: string) =>
  parseFloat(value.toFixed(currencyDecimals(currency)));

/**
 * Tax to add on top of a tax-exclusive amount.
 * e.g. calculateTaxOnAmount(100, 15) => 15
 */
export const calculateTaxOnAmount = (
  amount: number,
  taxPercentage: number,
  currency?: string,
): number => {
  if (taxPercentage <= 0 || amount <= 0) return 0;
  return roundTax((amount * taxPercentage) / 100, currency);
};

/**
 * Tax already contained in a tax-inclusive amount.
 * amount = net × (1 + rate)  =>  tax = amount − amount / (1 + rate)
 * e.g. extractTaxFromAmount(115, 15) => 15
 */
export const extractTaxFromAmount = (
  amount: number,
  taxPercentage: number,
  currency?: string,
): number => {
  if (taxPercentage <= 0 || amount <= 0) return 0;
  return roundTax(amount - amount / (1 + taxPercentage / 100), currency);
};
