import {
  cleanMoney,
  currencyDecimals,
  fromMinorUnits,
  normalizeCurrency,
  roundMoney,
  toMinorUnits,
} from './currency.util';

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

describe('fromMinorUnits', () => {
  it.each([
    [10000, 'SAR', 100],
    [2550, 'SAR', 25.5],
    [12345, 'KWD', 12.345],
    [1500, 'JPY', 1500],
  ])('%d %s → %d', (minor, currency, expected) => {
    expect(fromMinorUnits(minor, currency)).toBe(expected);
  });
});

describe("money rounding in the currency's smallest unit", () => {
  it("knows each currency's decimals", () => {
    expect(currencyDecimals('SAR')).toBe(2);
    expect(currencyDecimals('TRY')).toBe(2);
    expect(currencyDecimals('KWD')).toBe(3);
    expect(currencyDecimals('BHD')).toBe(3);
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals(undefined)).toBe(2);
  });

  it('keeps the fils of a 3-decimal currency', () => {
    expect(roundMoney(1.2554, 'KWD')).toBe(1.255);
    expect(roundMoney(1.2554, 'SAR')).toBe(1.26);
    expect(roundMoney(1.2554)).toBe(1.26);
    expect(roundMoney(1499.6, 'JPY')).toBe(1500);
  });

  it('cleans float noise off sums of rounded amounts, whatever the currency', () => {
    expect(cleanMoney(0.1 + 0.2)).toBe(0.3);
    expect(cleanMoney(345.123 - 28.755)).toBe(316.368);
  });
});
