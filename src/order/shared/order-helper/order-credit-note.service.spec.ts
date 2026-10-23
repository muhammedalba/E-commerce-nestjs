import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrderCreditNoteService } from './order-credit-note.service';

jest.mock('src/invoice/credit-note.service', () => ({
  CreditNoteService: class {},
}));
jest.mock('src/payments/payment-refund.service', () => ({
  PaymentRefundService: class {},
}));
jest.mock('./product.helper', () => ({ ProductHelperService: class {} }));
jest.mock('./order-email.service', () => ({ OrderEmailService: class {} }));
jest.mock('src/settings/settings.service', () => ({
  SettingsService: class {},
}));
jest.mock('src/shipping/shipping-rates.service', () => ({
  ShippingRatesService: class {},
}));

const query = <T>(value: T) => {
  const q = {
    select: () => q,
    populate: () => q,
    lean: () => Promise.resolve(value),
  };
  return q;
};

const orderId = new Types.ObjectId().toString();
const lines = [
  {
    itemIndex: 1,
    quantity: 12,
    productId: new Types.ObjectId(),
    variantId: new Types.ObjectId(),
  },
];

function setup(
  order: Record<string, unknown>,
  { uncreditedRefund = 0, restock = true, deductions = {}, shipping = 25 } = {},
) {
  const reserved = {
    _id: new Types.ObjectId(),
    order: new Types.ObjectId(orderId),
    lines,
    restock,
    amounts: { total: 227.7, tax: 29.7 },
    deductions,
  };
  const creditNoteService = {
    reserve: jest.fn(() => Promise.resolve(reserved)),
    summary: jest.fn(() =>
      Promise.resolve({
        invoiceIssued: true,
        remaining: [20, 8],
        uncreditedRefund,
      }),
    ),
    issue: jest.fn((_id: unknown, refund: unknown) =>
      Promise.resolve({
        ...reserved,
        state: 'issued',
        displayNumber: 'RUH-R-8-2026-0001',
        refund,
        restocked: false,
      }),
    ),
    void: jest.fn(() => Promise.resolve()),
    markRestocked: jest.fn(() => Promise.resolve()),
  };
  const OrderModel = {
    findById: jest.fn(() =>
      query({ user: new Types.ObjectId(), invoiceNumber: 8554, ...order }),
    ),
    updateOne: jest.fn(() => Promise.resolve()),
  };
  const UserModel = {
    findById: jest.fn(() => query({ email: 'a@b.c', name: 'Ali' })),
  };
  const paymentRefundService = {
    refundOrder: jest.fn(() => Promise.resolve({})),
  };
  const productHelperService = {
    restockOrderItems: jest.fn(() => Promise.resolve()),
  };
  const orderEmailService = {
    sendCreditNoteEmail: jest.fn(() => Promise.resolve()),
  };
  const shippingRatesService = {
    calculateShipping: jest.fn(() =>
      Promise.resolve([{ providerId: 'p1', totalShippingCost: shipping }]),
    ),
    selectShippingOption: jest.fn(
      (options: { totalShippingCost: number }[]) => options[0],
    ),
    calculateShippingCost: jest.fn(
      (chosen: { totalShippingCost: number }) => chosen.totalShippingCost,
    ),
  };
  const settingsService = { getSettings: jest.fn(() => Promise.resolve({})) };
  const service = new OrderCreditNoteService(
    OrderModel as never,
    UserModel as never,
    creditNoteService as never,
    paymentRefundService as never,
    productHelperService as never,
    orderEmailService as never,
    shippingRatesService as never,
    settingsService as never,
  );
  return {
    service,
    creditNoteService,
    OrderModel,
    paymentRefundService,
    productHelperService,
    orderEmailService,
    shippingRatesService,
  };
}

const input = {
  lines: [{ itemIndex: 1, quantity: 12 }],
  reason: 'returned',
  reasonType: 'defect' as const,
  restock: true,
};
const admin = { id: new Types.ObjectId().toString(), email: 'admin@x' };

describe('OrderCreditNoteService.createFromAdmin', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('refunds a paid Moyasar order, issues, restocks and emails', async () => {
    const ctx = setup({ paymentMethodCode: 'moyasar', paymentStatus: 'PAID' });
    const note = await ctx.service.createFromAdmin(orderId, input, admin);

    expect(ctx.paymentRefundService.refundOrder).toHaveBeenCalledWith(
      orderId,
      { amount: 227.7, reason: 'returned' },
      admin,
    );
    expect(ctx.creditNoteService.issue).toHaveBeenCalledWith(
      expect.anything(),
      { via: 'moyasar', amount: 227.7 },
    );
    expect(ctx.productHelperService.restockOrderItems).toHaveBeenCalledWith(
      [
        {
          productId: lines[0].productId,
          variantId: lines[0].variantId,
          quantity: 12,
        },
      ],
      'deducted',
    );
    expect(ctx.creditNoteService.markRestocked).toHaveBeenCalled();
    expect(ctx.orderEmailService.sendCreditNoteEmail).toHaveBeenCalledWith(
      // The only email: it carries the refund too
      expect.objectContaining({
        displayNumber: 'RUH-R-8-2026-0001',
        refund: { via: 'moyasar', amount: 227.7 },
      }),
      expect.anything(),
      { email: 'a@b.c', name: 'Ali' },
    );
    expect(note.displayNumber).toBe('RUH-R-8-2026-0001');
  });

  it('voids the credit note when the refund fails: no number, no stock', async () => {
    const ctx = setup({ paymentMethodCode: 'moyasar', paymentStatus: 'PAID' });
    ctx.paymentRefundService.refundOrder.mockRejectedValueOnce(
      new Error('Moyasar declined'),
    );

    await expect(
      ctx.service.createFromAdmin(orderId, input, admin),
    ).rejects.toThrow('Moyasar declined');
    expect(ctx.creditNoteService.void).toHaveBeenCalledWith(
      expect.anything(),
      'Moyasar declined',
    );
    expect(ctx.creditNoteService.issue).not.toHaveBeenCalled();
    expect(ctx.productHelperService.restockOrderItems).not.toHaveBeenCalled();
  });

  it('records a COD refund on the order (the money goes back by hand)', async () => {
    const ctx = setup({
      paymentMethodCode: 'cod',
      paymentStatus: 'PAID',
      refundedAmount: 0,
      grandTotal: 759,
    });
    await ctx.service.createFromAdmin(orderId, input, admin);

    expect(ctx.paymentRefundService.refundOrder).not.toHaveBeenCalled();
    expect(ctx.OrderModel.updateOne).toHaveBeenCalledWith(
      { _id: orderId },
      {
        $set: expect.objectContaining({
          refundedAmount: 227.7,
          paymentStatus: 'PARTIALLY_REFUNDED',
        }) as unknown,
      },
    );
    expect(ctx.creditNoteService.issue).toHaveBeenCalledWith(
      expect.anything(),
      { via: 'manual', amount: 227.7 },
    );
  });

  it('uses money refunded earlier without a credit note before refunding more', async () => {
    const ctx = setup(
      { paymentMethodCode: 'moyasar', paymentStatus: 'PARTIALLY_REFUNDED' },
      { uncreditedRefund: 100 },
    );
    await ctx.service.createFromAdmin(orderId, input, admin);
    expect(ctx.paymentRefundService.refundOrder).toHaveBeenCalledWith(
      orderId,
      { amount: 127.7, reason: 'returned' },
      admin,
    );

    const covered = setup(
      { paymentMethodCode: 'moyasar', paymentStatus: 'PARTIALLY_REFUNDED' },
      { uncreditedRefund: 300 },
    );
    await covered.service.createFromAdmin(orderId, input, admin);
    expect(covered.paymentRefundService.refundOrder).not.toHaveBeenCalled();
    expect(covered.creditNoteService.issue).toHaveBeenCalledWith(
      expect.anything(),
      { via: 'already_refunded', amount: 227.7 },
    );
  });

  it('refunds nothing on an unpaid order', async () => {
    const ctx = setup({ paymentMethodCode: 'cod', paymentStatus: 'PENDING' });
    await ctx.service.createFromAdmin(orderId, input, admin);
    expect(ctx.OrderModel.updateOne).not.toHaveBeenCalled();
    expect(ctx.creditNoteService.issue).toHaveBeenCalledWith(
      expect.anything(),
      { via: 'none', amount: 0 },
    );
  });

  it('leaves the stock alone when asked', async () => {
    const ctx = setup(
      { paymentMethodCode: 'cod', paymentStatus: 'PENDING' },
      { restock: false },
    );
    await ctx.service.createFromAdmin(
      orderId,
      { ...input, restock: false },
      admin,
    );
    expect(ctx.productHelperService.restockOrderItems).not.toHaveBeenCalled();
  });
});

describe('OrderCreditNoteService.createForFullRefund', () => {
  it('credits everything left, keyed by the refund transaction', async () => {
    const ctx = setup({});
    const result = await ctx.service.createForFullRefund(orderId, 't1', true);

    expect(ctx.creditNoteService.reserve).toHaveBeenCalledWith(
      orderId,
      'all',
      expect.objectContaining({
        source: 'full_refund',
        idempotencyKey: 'full:t1',
        restock: true,
      }),
    );
    expect(ctx.creditNoteService.issue).toHaveBeenCalledWith(
      expect.anything(),
      { via: 'already_refunded', amount: 227.7 },
    );
    expect(result.invoiceIssued).toBe(true);
  });

  it('says so when there is no issued invoice to credit', async () => {
    const ctx = setup({});
    ctx.creditNoteService.summary.mockResolvedValueOnce({
      invoiceIssued: false,
      remaining: [],
      uncreditedRefund: 0,
    });
    await expect(
      ctx.service.createForFullRefund(orderId, 't1', true),
    ).resolves.toEqual({ note: null, invoiceIssued: false });
    expect(ctx.creditNoteService.reserve).not.toHaveBeenCalled();
  });
});

describe('OrderCreditNoteService.coversRefund', () => {
  const withNotes = (notes: unknown[]) => {
    const ctx = setup({});
    (
      ctx.creditNoteService as unknown as { listForOrder: jest.Mock }
    ).listForOrder = jest.fn(() => Promise.resolve(notes));
    return ctx.service;
  };

  it('is covered by issued credit notes and the one awaiting its refund', async () => {
    const service = withNotes([
      { state: 'issued', amounts: { total: 100 }, refund: { via: 'moyasar' } },
      { state: 'awaiting_refund', amounts: { total: 127.7 } },
    ]);
    await expect(service.coversRefund(orderId, 227.7)).resolves.toBe(true);
  });

  it('is not covered beyond them (a partial refund made without items)', async () => {
    const service = withNotes([
      { state: 'issued', amounts: { total: 100 }, refund: { via: 'moyasar' } },
      // An unpaid order's credit note refunded nothing
      { state: 'issued', amounts: { total: 50 }, refund: { via: 'none' } },
    ]);
    await expect(service.coversRefund(orderId, 150)).resolves.toBe(false);
    await expect(withNotes([]).coversRefund(orderId, 1)).resolves.toBe(false);
  });
});

describe('OrderCreditNoteService: who pays the shipping', () => {
  const city = new Types.ObjectId();
  const country = new Types.ObjectId();
  const provider = new Types.ObjectId();
  const shipped = {
    paymentMethodCode: 'moyasar',
    paymentStatus: 'PAID',
    shippingAmount: 35,
    totalPrice: 660,
    discountAmount: 60,
    shippingAddress: { city, country },
    shippingProviderId: provider,
    items: [{ weight: 1 }, { weight: 0.5 }],
    currency: 'SAR',
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("prices the returned lines' shipping like checkout, for their weight", async () => {
    const ctx = setup(shipped);
    await ctx.service.createFromAdmin(orderId, input, admin);

    // Defect: 12 × 0.5 kg to the order's address; the threshold on 660 − 60
    expect(ctx.shippingRatesService.calculateShipping).toHaveBeenCalledWith(
      city.toString(),
      6,
      600,
      country.toString(),
      undefined,
      'SAR',
    );
    expect(ctx.shippingRatesService.calculateShippingCost).toHaveBeenCalledWith(
      expect.anything(),
      600,
      {},
    );
    expect(ctx.creditNoteService.reserve).toHaveBeenCalledWith(
      orderId,
      input.lines,
      expect.objectContaining({
        policy: { reasonType: 'defect', returnShipping: 25 },
      }),
    );
  });

  it('charges the return shipping for other reasons, even after free shipping', async () => {
    // The order reached free shipping: it paid none
    const ctx = setup({ ...shipped, shippingAmount: 0 });
    await ctx.service.createFromAdmin(
      orderId,
      { ...input, reasonType: 'other' },
      admin,
    );

    // A subtotal of 0 reaches no rate's threshold; the store's is not applied
    expect(ctx.shippingRatesService.calculateShipping).toHaveBeenCalledWith(
      city.toString(),
      6,
      0,
      country.toString(),
      undefined,
      'SAR',
    );
    expect(
      ctx.shippingRatesService.calculateShippingCost,
    ).not.toHaveBeenCalled();
    expect(ctx.shippingRatesService.selectShippingOption).toHaveBeenCalledWith(
      expect.any(Array),
      provider.toString(),
    );
    expect(ctx.creditNoteService.reserve).toHaveBeenCalledWith(
      orderId,
      input.lines,
      expect.objectContaining({
        policy: { reasonType: 'other', returnShipping: 25 },
      }),
    );
  });

  it('prices no shipping for a defect return of an order that shipped free', async () => {
    const ctx = setup({ ...shipped, shippingAmount: 0 });
    await ctx.service.createFromAdmin(orderId, input, admin);
    expect(ctx.shippingRatesService.calculateShipping).not.toHaveBeenCalled();
    expect(ctx.creditNoteService.reserve).toHaveBeenCalledWith(
      orderId,
      input.lines,
      expect.objectContaining({
        policy: { reasonType: 'defect', returnShipping: 0 },
      }),
    );
  });

  it('refunds the total less the return shipping kept back', async () => {
    const ctx = setup(shipped, {
      deductions: { returnShipping: { amount: 25, tax: 3.75, total: 28.75 } },
    });
    await ctx.service.createFromAdmin(
      orderId,
      { ...input, reasonType: 'other' },
      admin,
    );
    expect(ctx.paymentRefundService.refundOrder).toHaveBeenCalledWith(
      orderId,
      { amount: 198.95, reason: 'returned' },
      admin,
    );
    expect(ctx.orderEmailService.sendCreditNoteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ total: 227.7, returnShipping: 28.75 }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('refuses a return whose shipping cannot be priced', async () => {
    const ctx = setup(shipped);
    ctx.shippingRatesService.calculateShipping.mockRejectedValueOnce(
      new Error('No shipping rates available for this location'),
    );
    await expect(
      ctx.service.createFromAdmin(
        orderId,
        { ...input, reasonType: 'other' },
        admin,
      ),
    ).rejects.toThrow('The return shipping cannot be priced');
    expect(ctx.creditNoteService.reserve).not.toHaveBeenCalled();
  });
});

describe('OrderCreditNoteService.resendEmail', () => {
  const issuedNote = {
    _id: new Types.ObjectId(),
    order: new Types.ObjectId(orderId),
    displayNumber: 'RUH-R-8-2026-0001',
    amounts: { total: 345, tax: 45 },
    deductions: { returnShipping: { amount: 25, tax: 3.75, total: 28.75 } },
    snapshot: {
      summary: { deductionNote: 'خُصم…', deductionNoteEn: 'Deducted…' },
    },
    refund: { via: 'moyasar', amount: 316.25 },
  };

  it('emails an issued credit note again, with its deduction clause', async () => {
    const ctx = setup({});
    Object.assign(ctx.creditNoteService, {
      findIssued: jest.fn(() => Promise.resolve(issuedNote)),
    });
    await ctx.service.resendEmail(String(issuedNote._id));
    expect(ctx.orderEmailService.sendCreditNoteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        displayNumber: 'RUH-R-8-2026-0001',
        returnShipping: 28.75,
        deductionNote: 'خُصم…',
        refund: issuedNote.refund,
      }),
      expect.anything(),
      { email: 'a@b.c', name: 'Ali' },
    );
  });

  it('refuses a credit note that is not issued', async () => {
    const ctx = setup({});
    Object.assign(ctx.creditNoteService, {
      findIssued: jest.fn(() => Promise.resolve(null)),
    });
    await expect(
      ctx.service.resendEmail(new Types.ObjectId().toString()),
    ).rejects.toThrow('Credit note not found');
    expect(ctx.orderEmailService.sendCreditNoteEmail).not.toHaveBeenCalled();
  });
});
