import {
  calculateTaxOnAmount,
  extractTaxFromAmount,
} from './tax-calculation.util';

describe('tax calculation utils', () => {
  it('calculateTaxOnAmount adds the percentage on top of the amount', () => {
    expect(calculateTaxOnAmount(100, 15)).toBe(15);
    expect(calculateTaxOnAmount(30, 15)).toBe(4.5);
  });

  it('extractTaxFromAmount returns the tax contained in an inclusive amount', () => {
    expect(extractTaxFromAmount(115, 15)).toBe(15);
    expect(extractTaxFromAmount(149, 15)).toBe(19.43);
  });

  it('both return 0 for a zero rate or amount', () => {
    expect(calculateTaxOnAmount(100, 0)).toBe(0);
    expect(calculateTaxOnAmount(0, 15)).toBe(0);
    expect(extractTaxFromAmount(115, 0)).toBe(0);
    expect(extractTaxFromAmount(0, 15)).toBe(0);
  });
});

describe('VAT in a 3-decimal currency', () => {
  it('rounds to the fils, not the halala', () => {
    // 15 % of 1.255 KWD = 0.18825
    expect(calculateTaxOnAmount(1.255, 15, 'KWD')).toBe(0.188);
    expect(calculateTaxOnAmount(1.255, 15)).toBe(0.19);
    // 1.443 includes 15 %: 1.443 − 1.443 / 1.15 = 0.18822
    expect(extractTaxFromAmount(1.443, 15, 'KWD')).toBe(0.188);
  });
});
