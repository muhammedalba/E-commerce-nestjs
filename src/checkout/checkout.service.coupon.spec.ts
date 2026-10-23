import { Types } from 'mongoose';

// Pulls in sharp and the ESM-only uuid through its services; unused here
jest.mock('src/file-upload/file-upload.service', () => ({
  FileUploadService: class {},
}));

import { CheckoutService } from './checkout.service';

const items = [
  {
    productId: new Types.ObjectId().toString(),
    variantId: 'va',
    quantity: 2,
    weight: 1,
    price: 100,
  },
  {
    productId: new Types.ObjectId().toString(),
    variantId: 'vb',
    quantity: 1,
    weight: 1,
    price: 300,
  },
];

/** Reaches the two private steps the line discounts go through. */
type Internals = {
  applyCoupon: (
    code: string | undefined,
    userId: string,
    subtotal: number,
    items: unknown[],
  ) => Promise<{ discountAmount: number; lineDiscounts: number[] }>;
  buildCheckoutResponse: (params: Record<string, unknown>) => {
    summary: { discountAmount: number; totalPrice: number };
    items: { discount: number }[];
  };
};

function setup(result: Record<string, unknown> | null) {
  const couponHelperService = {
    applyCouponIfAvailable: jest.fn(() => Promise.resolve(result)),
  };
  const service = new CheckoutService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    couponHelperService as never,
    {} as never,
  ) as unknown as Internals;
  return service;
}

const buildWith = (service: Internals, couponResult: Record<string, unknown>) =>
  service.buildCheckoutResponse({
    dto: { items, cityId: 'c1' },
    city: { name: 'Riyadh' },
    cartTotals: { subtotal: 500, totalWeight: 3 },
    couponResult,
    taxDetails: {
      taxAmount: 60,
      chargedTaxAmount: 60,
      productsAmountBeforeTax: 400,
      productsAmountAfterTax: 460,
      taxPercentage: 15,
      isIncluded: false,
    },
    shippingOptions: [],
    chosenShipping: null,
    chosenPaymentMethod: null,
    shippingCost: 30,
    paymentFees: 0,
    currency: 'SAR',
    applyTaxOnCharges: false,
  });

describe('CheckoutService: each line keeps its coupon share', () => {
  it('passes the line shares on, totals unchanged', async () => {
    const service = setup({
      discountAmount: 100,
      totalPrice: 500,
      totalPriceAfterDiscount: 400,
      lineDiscounts: [100, 0],
      couponDetails: { couponCode: 'SAVE' },
    });
    const coupon = await service.applyCoupon('SAVE', 'u1', 500, items);
    expect(coupon.lineDiscounts).toEqual([100, 0]);

    const response = buildWith(service, coupon);
    expect(response.items.map((i) => i.discount)).toEqual([100, 0]);
    // The order's own numbers do not move
    expect(response.summary.discountAmount).toBe(100);
    expect(response.summary.totalPrice).toBe(400 + 30 + 60);
  });

  it('gives every line 0 without a coupon', async () => {
    const service = setup(null);
    const coupon = await service.applyCoupon(undefined, 'u1', 500, items);
    expect(coupon.lineDiscounts).toEqual([0, 0]);
    expect(buildWith(service, coupon).items.map((i) => i.discount)).toEqual([
      0, 0,
    ]);
  });
});
