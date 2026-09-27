import { normalizeCurrency, toMinorUnits } from './currency.util';

describe('currency.util', () => {
  it.each([
    [100, 'SAR', 10000],
    [100.5, 'sar', 10050],
    [100, 'ر.س', 10000],
    [12.345, 'KWD', 12345],
    [5, 'OMR', 5000],
    [1500, 'JPY', 1500],
    [19.99, 'USD', 1999],
  ])('%d %s → %d minor units', (amount, currency, expected) => {
    expect(toMinorUnits(amount, currency)).toBe(expected);
  });

  it('rounds away floating point noise', () => {
    expect(toMinorUnits(0.1 + 0.2, 'SAR')).toBe(30);
  });

  it('normalizes like the checkout page', () => {
    expect(normalizeCurrency(' sar ')).toBe('SAR');
    expect(normalizeCurrency('ر.س.')).toBe('SAR');
    expect(normalizeCurrency(undefined)).toBe('');
  });
});
