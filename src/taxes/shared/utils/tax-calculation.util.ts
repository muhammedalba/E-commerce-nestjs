const round2 = (value: number) => parseFloat(value.toFixed(2));

/**
 * Tax to add on top of a tax-exclusive amount.
 * e.g. calculateTaxOnAmount(100, 15) => 15
 */
export const calculateTaxOnAmount = (
  amount: number,
  taxPercentage: number,
): number => {
  if (taxPercentage <= 0 || amount <= 0) return 0;
  return round2((amount * taxPercentage) / 100);
};

/**
 * Tax already contained in a tax-inclusive amount.
 * amount = net × (1 + rate)  =>  tax = amount − amount / (1 + rate)
 * e.g. extractTaxFromAmount(115, 15) => 15
 */
export const extractTaxFromAmount = (
  amount: number,
  taxPercentage: number,
): number => {
  if (taxPercentage <= 0 || amount <= 0) return 0;
  return round2(amount - amount / (1 + taxPercentage / 100));
};
