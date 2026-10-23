import { toMinorUnits } from 'src/payments/shared/utils/currency.util';

/**
 * Which order lines a coupon applies to, and how its discount splits across
 * them. Pure: shared by checkout (CouponHelperService, which freezes each
 * line's share on the order) and credit notes (an old order's estimate).
 */

/** The coupon fields that decide which lines it covers. */
export interface CouponScope {
  applyTo: 'all' | 'products' | 'categories' | 'brands';
  applyItems?: string[];
}

/** A line as the scope sees it: its product, brand and category ids. */
export interface ScopedLine {
  productId: { toString(): string } | string;
  brand?: { toString(): string } | string | null;
  category?: { toString(): string } | string | null;
}

/** True when the coupon covers this line (every line for `all`). */
export function isCouponEligible(
  coupon: CouponScope,
  line: ScopedLine,
): boolean {
  if (coupon.applyTo === 'all') return true;
  const value =
    coupon.applyTo === 'brands'
      ? line.brand
      : coupon.applyTo === 'categories'
        ? line.category
        : line.productId;
  return value != null && (coupon.applyItems ?? []).includes(String(value));
}

/**
 * Each line's share of `discount`: lines the coupon covers share it in
 * proportion to their value (price × quantity); the others get 0. Worked in
 * the currency's smallest unit (halalas for SAR, fils for KWD; default
 * halalas), the rounding remainder going to the largest fractions, so the
 * shares add up to the discount rounded to that unit, exactly.
 */
export function allocateCouponDiscount(
  discount: number,
  lines: { price: number; quantity: number; eligible: boolean }[],
  currency?: string,
): number[] {
  const factor = toMinorUnits(1, currency || 'SAR');
  const values = lines.map((l) => (l.eligible ? l.price * l.quantity : 0));
  const base = values.reduce((sum, v) => sum + v, 0);
  const totalMinor = toMinorUnits(discount, currency || 'SAR');
  if (base <= 0 || totalMinor <= 0) return lines.map(() => 0);

  const exact = values.map((v) => (totalMinor * v) / base);
  const shares = exact.map(Math.floor);
  let left = totalMinor - shares.reduce((sum, s) => sum + s, 0);
  const byFraction = exact
    .map((e, i) => ({ i, fraction: e - Math.floor(e) }))
    .filter(({ i }) => values[i] > 0)
    .sort((a, b) => b.fraction - a.fraction);
  for (const { i } of byFraction) {
    if (left <= 0) break;
    shares[i] += 1;
    left -= 1;
  }
  return shares.map((h) => h / factor);
}
