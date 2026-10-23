import { Types } from 'mongoose';
import { allocateCouponDiscount, isCouponEligible } from './coupon-allocation';

const product = new Types.ObjectId();
const brand = new Types.ObjectId();
const category = new Types.ObjectId();
const line = { productId: product, brand, category };
const other = {
  productId: new Types.ObjectId(),
  brand: new Types.ObjectId(),
  category: new Types.ObjectId(),
};

describe('isCouponEligible', () => {
  it('covers every line for a coupon on the whole order', () => {
    expect(isCouponEligible({ applyTo: 'all' }, other)).toBe(true);
  });

  it('matches the product, category or brand the coupon names', () => {
    for (const [applyTo, id] of [
      ['products', product],
      ['categories', category],
      ['brands', brand],
    ] as const) {
      const coupon = { applyTo, applyItems: [String(id)] };
      expect(isCouponEligible(coupon, line)).toBe(true);
      expect(isCouponEligible(coupon, other)).toBe(false);
    }
  });

  it('does not match a line with no brand or category', () => {
    const coupon = { applyTo: 'brands' as const, applyItems: [String(brand)] };
    expect(
      isCouponEligible(coupon, { productId: product, brand: undefined }),
    ).toBe(false);
  });
});

describe('allocateCouponDiscount', () => {
  const sum = (shares: number[]) =>
    Math.round(shares.reduce((s, x) => s + x, 0) * 100) / 100;

  it('gives the whole discount to the lines the coupon covers', () => {
    // 50 % of A (2 × 100): B (300) is not covered
    expect(
      allocateCouponDiscount(100, [
        { price: 100, quantity: 2, eligible: true },
        { price: 300, quantity: 1, eligible: false },
      ]),
    ).toEqual([100, 0]);
  });

  it('shares it by value among the covered lines', () => {
    expect(
      allocateCouponDiscount(50, [
        { price: 100, quantity: 2, eligible: true },
        { price: 300, quantity: 1, eligible: true },
      ]),
    ).toEqual([20, 30]);
  });

  it('adds up to the discount to the halala, whatever the rounding', () => {
    const three = [1, 2, 3].map(() => ({
      price: 10,
      quantity: 1,
      eligible: true,
    }));
    const shares = allocateCouponDiscount(10, three);
    expect(shares).toEqual([3.34, 3.33, 3.33]);
    expect(sum(shares)).toBe(10);

    // An unrounded discount (10 % of 333.33): the shares make its halalas
    const odd = allocateCouponDiscount(33.333, [
      { price: 111.11, quantity: 1, eligible: true },
      { price: 222.22, quantity: 1, eligible: true },
    ]);
    expect(sum(odd)).toBe(33.33);
  });

  it('gives nothing when there is no discount or nothing is covered', () => {
    const lines = [{ price: 100, quantity: 1, eligible: false }];
    expect(allocateCouponDiscount(20, lines)).toEqual([0]);
    expect(
      allocateCouponDiscount(0, [{ price: 100, quantity: 1, eligible: true }]),
    ).toEqual([0]);
  });
});

describe('allocateCouponDiscount in a 3-decimal currency', () => {
  it('shares in fils, adding up to the discount exactly', () => {
    const lines = [1, 1, 1].map(() => ({
      price: 1,
      quantity: 1,
      eligible: true,
    }));
    const shares = allocateCouponDiscount(0.01, lines, 'KWD');
    expect(shares).toEqual([0.004, 0.003, 0.003]);
    expect(Math.round(shares.reduce((s, v) => s + v, 0) * 1000)).toBe(10);
  });
});
