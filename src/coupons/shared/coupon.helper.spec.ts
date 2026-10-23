import { Types } from 'mongoose';
import { CouponHelperService } from './coupon.helper';

const productA = new Types.ObjectId();
const productB = new Types.ObjectId();
const brand = new Types.ObjectId().toString();
const category = new Types.ObjectId().toString();

// A: 2 × 100, B: 1 × 300 (totalPrice 500)
const items = [
  {
    product: { id: productA, brand, category },
    quantity: 2,
    variantId: 'va',
    weight: 1,
    price: 100,
  },
  {
    product: { id: productB, brand: 'other', category: 'other' },
    quantity: 1,
    variantId: 'vb',
    weight: 1,
    price: 300,
  },
];

function setup(coupon: Record<string, unknown>) {
  const couponModel = {
    findOne: jest.fn(() =>
      Promise.resolve({
        _id: new Types.ObjectId(),
        name: 'SAVE',
        active: true,
        usedByUsers: [],
        ...coupon,
      }),
    ),
  };
  return new CouponHelperService(
    couponModel as never,
    { translate: (k: string) => k } as never,
  );
}

describe('CouponHelperService.applyCouponIfAvailable line discounts', () => {
  it('puts a coupon on some products on those lines only', async () => {
    const service = setup({
      type: 'percentage',
      discount: 50,
      applyTo: 'products',
      applyItems: [productA.toString()],
    });
    const result = await service.applyCouponIfAvailable(
      'SAVE',
      'u1',
      500,
      items,
    );
    // Unchanged: 50 % of A's 200
    expect(result.discountAmount).toBe(100);
    expect(result.totalPriceAfterDiscount).toBe(400);
    expect(result.lineDiscounts).toEqual([100, 0]);
  });

  it('shares a coupon on the whole order by value', async () => {
    const service = setup({ type: 'fixed', discount: 50, applyTo: 'all' });
    const result = await service.applyCouponIfAvailable(
      'SAVE',
      'u1',
      500,
      items,
    );
    expect(result.discountAmount).toBe(50);
    expect(result.lineDiscounts).toEqual([20, 30]);
  });

  it('matches by brand and category as before', async () => {
    for (const applyTo of ['brands', 'categories']) {
      const service = setup({
        type: 'fixed',
        discount: 40,
        applyTo,
        applyItems: [applyTo === 'brands' ? brand : category],
      });
      const result = await service.applyCouponIfAvailable(
        'SAVE',
        'u1',
        500,
        items,
      );
      expect(result.lineDiscounts).toEqual([40, 0]);
    }
  });

  it('still refuses a coupon no line is eligible for', async () => {
    const service = setup({
      type: 'fixed',
      discount: 40,
      applyTo: 'products',
      applyItems: [new Types.ObjectId().toString()],
    });
    await expect(
      service.applyCouponIfAvailable('SAVE', 'u1', 500, items),
    ).rejects.toThrow('INVALID_ITEMS_IN_ORDER');
  });

  it('gives every line 0 without a coupon', async () => {
    const result = await setup({}).applyCouponIfAvailable(
      undefined,
      'u1',
      500,
      items,
    );
    expect(result.lineDiscounts).toEqual([0, 0]);
  });
});

describe('CouponHelperService in a 3-decimal currency', () => {
  it('rounds the discount and the total to the fils', async () => {
    const service = setup({ type: 'percentage', discount: 10, applyTo: 'all' });
    const kwdItems = items.map((item) => ({
      ...item,
      price: 1.255,
      quantity: 3,
    }));
    const result = await service.applyCouponIfAvailable(
      'SAVE',
      'u1',
      7.53,
      kwdItems,
      'KWD',
    );
    // 10 % of 7.53 = 0.753, kept to the fils (0.75 in halalas)
    expect(result.discountAmount).toBe(0.753);
    expect(result.totalPriceAfterDiscount).toBe(6.777);
    expect(result.lineDiscounts).toEqual([0.377, 0.376]);
  });
});
