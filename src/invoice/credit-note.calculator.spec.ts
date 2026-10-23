import { Types } from 'mongoose';
import {
  allRemainingLines,
  calculateCreditNote,
  CreditOrderInput,
  PriorCreditNote,
  remainingQuantities,
} from './credit-note.calculator';

const line = (price: number, quantity: number) => ({
  productId: new Types.ObjectId(),
  variantId: new Types.ObjectId(),
  price,
  quantity,
});

/**
 * The store's own invoice 8554 and its credit note 121 (the PDFs the store
 * sent): 2 × 20 joint sealant at 16.50, VAT 15 % on top; 12 grey returned.
 */
const invoice8554: CreditOrderInput = {
  items: [line(16.5, 20), line(16.5, 20)],
  totalPrice: 660,
  discountAmount: 0,
  shippingAmount: 0,
  paymentFees: 0,
  taxPercentage: 15,
  taxesIncluded: false,
  applyTaxOnCharges: false,
};
const totals8554 = { grandTotal: 759, tax: 99 };

const asPrior = (
  calc: ReturnType<typeof calculateCreditNote>,
): PriorCreditNote => ({ lines: calc.lines, amounts: calc.amounts });

describe('calculateCreditNote', () => {
  it('matches the store credit note 121: 12 × 16.50 + 15 % VAT', () => {
    const note = calculateCreditNote(
      invoice8554,
      totals8554,
      [],
      [{ itemIndex: 1, quantity: 12 }],
    );
    expect(note.amounts).toEqual({
      products: 198,
      discount: 0,
      productsBeforeTax: 198,
      productsAfterTax: 227.7,
      shipping: 0,
      paymentFees: 0,
      chargesTax: 0,
      taxable: 198,
      tax: 29.7,
      total: 227.7,
    });
    expect(note.includesCharges).toBe(false);
    expect(note.lines).toEqual([
      expect.objectContaining({ itemIndex: 1, quantity: 12 }),
    ]);
  });

  it('makes all credit notes add up to the invoice exactly', () => {
    const first = calculateCreditNote(
      invoice8554,
      totals8554,
      [],
      [{ itemIndex: 1, quantity: 12 }],
    );
    const prior = [asPrior(first)];
    expect(remainingQuantities(invoice8554, prior)).toEqual([20, 8]);

    const rest = calculateCreditNote(
      invoice8554,
      totals8554,
      prior,
      allRemainingLines(invoice8554, prior),
    );
    expect(rest.includesCharges).toBe(true);
    expect(rest.amounts.total).toBe(531.3);
    expect(rest.amounts.tax).toBe(69.3);
    expect(first.amounts.total + rest.amounts.total).toBe(759);
    expect(first.amounts.tax + rest.amounts.tax).toBe(99);
  });

  it('shares the coupon and extracts VAT from tax-inclusive prices', () => {
    const order: CreditOrderInput = {
      items: [line(250.5, 2), line(333, 3)],
      totalPrice: 1500,
      discountAmount: 100,
      shippingAmount: 35,
      paymentFees: 0,
      taxPercentage: 15,
      taxesIncluded: true,
      applyTaxOnCharges: true,
    };
    const note = calculateCreditNote(
      order,
      { grandTotal: 1440.25, tax: 186.01 },
      [],
      [{ itemIndex: 0, quantity: 1 }],
    );
    // 250.50 − 100 × 250.50 / 1500 = 233.80 including VAT
    expect(note.amounts).toMatchObject({
      products: 250.5,
      discount: 16.7,
      productsAfterTax: 233.8,
      productsBeforeTax: 203.3,
      tax: 30.5,
      total: 233.8,
      shipping: 0,
    });
  });

  it('refunds shipping and fees, with their VAT, with the last lines', () => {
    const order: CreditOrderInput = {
      items: [line(100, 1)],
      totalPrice: 100,
      discountAmount: 0,
      shippingAmount: 20,
      paymentFees: 5,
      taxPercentage: 15,
      taxesIncluded: false,
      applyTaxOnCharges: true,
    };
    // Invoice: 100 + 20 + 5 + 15 % of 125 = 143.75
    const note = calculateCreditNote(
      order,
      { grandTotal: 143.75, tax: 18.75 },
      [],
      [{ itemIndex: 0, quantity: 1 }],
    );
    expect(note.includesCharges).toBe(true);
    expect(note.amounts).toMatchObject({
      shipping: 20,
      paymentFees: 5,
      taxable: 125,
      tax: 18.75,
      total: 143.75,
    });
  });

  it('refunds no VAT on a VAT-free order', () => {
    const order = { ...invoice8554, taxPercentage: 0 };
    const note = calculateCreditNote(
      order,
      { grandTotal: 660, tax: 0 },
      [],
      [{ itemIndex: 0, quantity: 2 }],
    );
    expect(note.amounts).toMatchObject({ tax: 0, total: 33, taxable: 33 });
  });

  it('uses the invoice estimate of 15 % for orders that never stored a rate', () => {
    const { taxPercentage: _, ...legacy } = invoice8554;
    void _;
    const note = calculateCreditNote(
      legacy,
      totals8554,
      [],
      [{ itemIndex: 0, quantity: 10 }],
    );
    expect(note.amounts.tax).toBe(24.75);
  });

  it('refuses more than is left, duplicates, and bad quantities', () => {
    const prior = [
      asPrior(
        calculateCreditNote(
          invoice8554,
          totals8554,
          [],
          [{ itemIndex: 0, quantity: 15 }],
        ),
      ),
    ];
    const tryLines = (lines: { itemIndex: number; quantity: number }[]) => () =>
      calculateCreditNote(invoice8554, totals8554, prior, lines);

    expect(tryLines([{ itemIndex: 0, quantity: 6 }])).toThrow(
      'only 5 left to return',
    );
    expect(
      tryLines([
        { itemIndex: 1, quantity: 1 },
        { itemIndex: 1, quantity: 1 },
      ]),
    ).toThrow('listed twice');
    expect(tryLines([{ itemIndex: 1, quantity: 0 }])).toThrow('whole number');
    expect(tryLines([{ itemIndex: 1, quantity: 1.5 }])).toThrow('whole number');
    expect(tryLines([{ itemIndex: 7, quantity: 1 }])).toThrow('Unknown');
    expect(tryLines([])).toThrow('at least one line');
  });
});

describe('calculateCreditNote with a coupon on some items', () => {
  /**
   * A: 2 × 100, B: 1 × 300; coupon 50 % on A only (100 off). VAT 15 % on
   * top, shipping 30 untaxed: invoice 400 + 60 + 30 = 490.
   */
  const scoped = (frozen: boolean): CreditOrderInput => ({
    items: [
      { ...line(100, 2), ...(frozen ? { discount: 100 } : {}) },
      { ...line(300, 1), ...(frozen ? { discount: 0 } : {}) },
    ],
    totalPrice: 500,
    discountAmount: 100,
    shippingAmount: 30,
    paymentFees: 0,
    taxPercentage: 15,
    taxesIncluded: false,
    applyTaxOnCharges: false,
  });
  const invoice = { grandTotal: 490, tax: 60 };

  it('refunds each line what it was really discounted', () => {
    const b = calculateCreditNote(
      scoped(true),
      invoice,
      [],
      [{ itemIndex: 1, quantity: 1 }],
    );
    // B had no discount: 300 + 15 % = 345
    expect(b.amounts).toMatchObject({ discount: 0, tax: 45, total: 345 });

    const a = calculateCreditNote(
      scoped(true),
      invoice,
      [],
      [{ itemIndex: 0, quantity: 1 }],
    );
    // One A: 100 − 50 = 50 + 15 % = 57.50
    expect(a.amounts).toMatchObject({ discount: 50, tax: 7.5, total: 57.5 });
  });

  it('empties a line with what is left of its share', () => {
    const order: CreditOrderInput = {
      ...scoped(true),
      items: [{ ...line(10, 3), discount: 10 }],
      totalPrice: 30,
      discountAmount: 10,
      shippingAmount: 0,
    };
    const totals = { grandTotal: 23, tax: 3 };
    const first = calculateCreditNote(
      order,
      totals,
      [],
      [{ itemIndex: 0, quantity: 1 }],
    );
    const second = calculateCreditNote(
      order,
      totals,
      [asPrior(first)],
      [{ itemIndex: 0, quantity: 1 }],
    );
    const last = calculateCreditNote(
      order,
      totals,
      [asPrior(first), asPrior(second)],
      [{ itemIndex: 0, quantity: 1 }],
    );
    expect([
      first.amounts.discount,
      second.amounts.discount,
      last.amounts.discount,
    ]).toEqual([3.33, 3.33, 3.34]);
    expect(
      first.amounts.total + second.amounts.total + last.amounts.total,
    ).toBeCloseTo(23, 10);
  });

  it("uses the service's estimate for an older order", () => {
    const old = { ...scoped(false), lineDiscounts: [100, 0] };
    const b = calculateCreditNote(
      old,
      invoice,
      [],
      [{ itemIndex: 1, quantity: 1 }],
    );
    expect(b.amounts.total).toBe(345);
  });

  it('keeps sharing by value for an older order with no estimate', () => {
    // The old behaviour, exact for a coupon on the whole order
    const b = calculateCreditNote(
      scoped(false),
      invoice,
      [],
      [{ itemIndex: 1, quantity: 1 }],
    );
    expect(b.amounts.discount).toBe(60);
  });
});

describe('calculateCreditNote: the return reason decides who pays the shipping', () => {
  /**
   * A: 2 × 100, B: 1 × 300, no coupon. VAT 15 % on top, also on the charges
   * (shipping 40, payment fees 10): invoice 500 + 75 + 50 + 7.5 = 632.5.
   */
  const order: CreditOrderInput = {
    items: [line(100, 2), line(300, 1)],
    totalPrice: 500,
    discountAmount: 0,
    shippingAmount: 40,
    paymentFees: 10,
    taxPercentage: 15,
    taxesIncluded: false,
    applyTaxOnCharges: true,
  };
  const invoice = { grandTotal: 632.5, tax: 82.5 };
  const B = [{ itemIndex: 1, quantity: 1 }];
  const A = [{ itemIndex: 0, quantity: 2 }];
  const defect = (returnShipping: number) => ({
    reasonType: 'defect' as const,
    returnShipping,
  });
  const other = (returnShipping: number) => ({
    reasonType: 'other' as const,
    returnShipping,
  });

  it('defect, some items: products, their VAT and their shipping', () => {
    const note = calculateCreditNote(order, invoice, [], B, defect(25));
    // 300 + 45, shipping 25 + 3.75
    expect(note.amounts).toMatchObject({
      shipping: 25,
      paymentFees: 0,
      chargesTax: 3.75,
      tax: 48.75,
      total: 373.75,
    });
    expect(note.deductions).toEqual({});
    expect(note.refundAmount).toBe(373.75);
    expect(note.includesCharges).toBe(false);
  });

  it('defect: never gives back more shipping than was paid', () => {
    const note = calculateCreditNote(order, invoice, [], B, defect(60));
    expect(note.amounts.shipping).toBe(40);
  });

  it('defect, the rest: everything left, so the notes add up to the invoice', () => {
    const first = calculateCreditNote(order, invoice, [], B, defect(25));
    const last = calculateCreditNote(
      order,
      invoice,
      [asPrior(first)],
      A,
      defect(30),
    );
    expect(last.amounts).toMatchObject({ shipping: 15, paymentFees: 10 });
    expect(last.includesCharges).toBe(true);
    expect(first.amounts.total + last.amounts.total).toBeCloseTo(632.5, 10);
    expect(first.amounts.tax + last.amounts.tax).toBeCloseTo(82.5, 10);
  });

  it('other: products and their VAT, the return shipping kept back', () => {
    const note = calculateCreditNote(order, invoice, [], B, other(25));
    expect(note.amounts).toMatchObject({
      shipping: 0,
      paymentFees: 0,
      tax: 45,
      total: 345,
    });
    // 25 + 15 % VAT, out of the refund, not out of the credit note
    expect(note.deductions).toEqual({
      returnShipping: { amount: 25, tax: 3.75, total: 28.75 },
    });
    expect(note.refundAmount).toBe(316.25);
  });

  it('other, everything: the invoice less its charges', () => {
    const note = calculateCreditNote(
      order,
      invoice,
      [],
      [...A, ...B],
      other(30),
    );
    expect(note.amounts).toMatchObject({
      shipping: 0,
      paymentFees: 0,
      tax: 75,
      total: 575,
    });
    expect(note.includesCharges).toBe(false);
    expect(note.refundAmount).toBe(575 - 34.5);
  });

  it('other, the rest after a defect return: the products part that is left', () => {
    const first = calculateCreditNote(order, invoice, [], B, defect(25));
    const last = calculateCreditNote(
      order,
      invoice,
      [asPrior(first)],
      A,
      other(30),
    );
    // A: 200 + 30; the shipping and fees left stay on the invoice
    expect(last.amounts).toMatchObject({ shipping: 0, tax: 30, total: 230 });
  });

  it('other, after free shipping: no return shipping to keep back', () => {
    const note = calculateCreditNote(order, invoice, [], B, other(0));
    expect(note.deductions).toEqual({});
    expect(note.refundAmount).toBe(345);
  });

  it('other, with no VAT on charges: the return shipping alone', () => {
    const note = calculateCreditNote(
      { ...order, applyTaxOnCharges: false },
      { grandTotal: 625, tax: 75 },
      [],
      B,
      other(25),
    );
    expect(note.deductions.returnShipping).toEqual({
      amount: 25,
      tax: 0,
      total: 25,
    });
  });

  it('other, with a coupon on some items: each line its own share', () => {
    const note = calculateCreditNote(
      {
        ...order,
        items: [
          { ...line(100, 2), discount: 100 },
          { ...line(300, 1), discount: 0 },
        ],
        discountAmount: 100,
      },
      { grandTotal: 517.5, tax: 67.5 },
      [],
      [{ itemIndex: 0, quantity: 1 }],
      other(20),
    );
    // One A: 100 − 50 + 15 % = 57.50, less 20 + 3 shipping
    expect(note.amounts.total).toBe(57.5);
    expect(note.refundAmount).toBe(34.5);
  });
});

describe('calculateCreditNote in a 3-decimal currency (KWD)', () => {
  // A: 2 × 1.255, B: 1 × 3.333; VAT 15 % on top, also on shipping 1.5
  const order: CreditOrderInput = {
    items: [line(1.255, 2), line(3.333, 1)],
    totalPrice: 5.843,
    discountAmount: 0,
    shippingAmount: 1.5,
    paymentFees: 0,
    taxPercentage: 15,
    taxesIncluded: false,
    applyTaxOnCharges: true,
    currency: 'KWD',
  };
  // As checkout stores it: VAT 0.876 + 0.225, total 5.843 + 1.5 + 1.101
  const invoice = { grandTotal: 8.444, tax: 1.101 };

  it('keeps the fils of every amount', () => {
    const b = calculateCreditNote(
      order,
      invoice,
      [],
      [{ itemIndex: 1, quantity: 1 }],
      {
        reasonType: 'defect',
        returnShipping: 1,
      },
    );
    // 3.333 + 15 % (0.49995 → 0.500), shipping 1 + 0.15
    expect(b.amounts).toMatchObject({
      products: 3.333,
      shipping: 1,
      chargesTax: 0.15,
      tax: 0.65,
      total: 4.983,
    });
  });

  it('adds up to the invoice to the fils', () => {
    const first = calculateCreditNote(
      order,
      invoice,
      [],
      [{ itemIndex: 0, quantity: 1 }],
      { reasonType: 'other', returnShipping: 0.75 },
    );
    // One A: 1.255 + 0.18825 → 0.188
    expect(first.amounts.total).toBe(1.443);
    // Return shipping 0.75 + 0.1125 → 0.113, out of the refund
    expect(first.deductions.returnShipping).toEqual({
      amount: 0.75,
      tax: 0.113,
      total: 0.863,
    });
    expect(first.refundAmount).toBe(0.58);

    const last = calculateCreditNote(
      order,
      invoice,
      [asPrior(first)],
      [
        { itemIndex: 0, quantity: 1 },
        { itemIndex: 1, quantity: 1 },
      ],
      { reasonType: 'defect', returnShipping: 0 },
    );
    expect(Math.round((first.amounts.total + last.amounts.total) * 1000)).toBe(
      8444,
    );
    expect(Math.round((first.amounts.tax + last.amounts.tax) * 1000)).toBe(
      1101,
    );
  });
});
