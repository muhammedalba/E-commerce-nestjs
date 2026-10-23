/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreditNoteService } from './credit-note.service';

jest.mock('src/file-upload/file-upload.service', () => ({
  FileUploadService: class {},
}));

/**
 * Enough of a Mongo collection for CreditNoteService: filters with $ne,
 * sessions accepted (and ignored: transactions are Mongo's; here the calls
 * just run in order).
 */
class FakeCollection {
  docs: any[] = [];

  private matches(doc: any, filter: any): boolean {
    return Object.entries(filter).every(([key, cond]: [string, any]) => {
      const value = doc[key];
      if (
        cond &&
        typeof cond === 'object' &&
        !(cond instanceof Types.ObjectId) &&
        '$ne' in cond
      ) {
        return value !== cond.$ne;
      }
      return String(value) === String(cond);
    });
  }

  private query(result: any) {
    const q: any = {
      populate: () => q,
      select: () => q,
      sort: () => q,
      session: () => q,
      lean: () => q,
      then: (ok: any, ko: any) => Promise.resolve(result).then(ok, ko),
    };
    return q;
  }

  find = (filter: any) =>
    this.query(this.docs.filter((d) => this.matches(d, filter)));

  findOne = (filter: any) =>
    this.query(this.docs.find((d) => this.matches(d, filter)) ?? null);

  findById = (id: any) => this.findOne({ _id: id });

  create = (docs: any[]) => {
    const created = docs.map((d) => {
      if (
        d.idempotencyKey &&
        this.docs.some((x) => x.idempotencyKey === d.idempotencyKey)
      ) {
        throw Object.assign(new Error('dup'), { code: 11000 });
      }
      const doc = { _id: new Types.ObjectId(), ...d };
      this.docs.push(doc);
      return doc;
    });
    return Promise.resolve(created);
  };

  findOneAndUpdate = (filter: any, update: any) => {
    const doc = this.docs.find((d) => this.matches(d, filter));
    if (doc) Object.assign(doc, update.$set);
    return this.query(doc ?? null);
  };

  updateOne = (filter: any, update: any) => {
    const doc = this.docs.find((d) => this.matches(d, filter));
    if (doc) {
      Object.assign(doc, update.$set);
      for (const [k, n] of Object.entries<number>(update.$inc ?? {})) {
        doc[k] = (doc[k] ?? 0) + n;
      }
    }
    return Promise.resolve({ modifiedCount: doc ? 1 : 0 });
  };
}

const orderId = new Types.ObjectId();
const line = (price: number, quantity: number) => ({
  productId: new Types.ObjectId(),
  variantId: new Types.ObjectId(),
  title: { ar: 'مانع تسرب', en: 'Joint sealant' },
  shippingSnapshot: { packageType: 'piece' },
  price,
  quantity,
  totalPrice: price * quantity,
});

function setup(order: Record<string, unknown> = {}) {
  const orders = new FakeCollection();
  const coupons = new FakeCollection();
  orders.docs.push({
    _id: orderId,
    invoiceNumber: 8554,
    items: [line(16.5, 20), line(16.5, 20)],
    totalPrice: 660,
    discountAmount: 0,
    shippingAmount: 0,
    paymentFees: 0,
    taxPercentage: 15,
    taxesIncluded: false,
    applyTaxOnCharges: false,
    grandTotal: 759,
    taxAmount: 99,
    ...order,
  });
  const invoices = new FakeCollection();
  invoices.docs.push({
    _id: new Types.ObjectId(),
    order: orderId,
    status: 'generated',
    displayNumber: 'RUH-8-2026-8554',
    snapshot: {
      kind: 'invoice',
      currencyCode: 'SAR',
      header: {
        siteNameAr: 'شركة مجرة السماء للتجارة',
        vatNo: '311658655700003',
      },
      meta: { date: '8/19/2026', placeOfDelivery: 'الدمام' },
      footer: { printedOn: 'Aug 19, 2026' },
      amounts: { grandTotal: 759, tax: 99 },
      logo: null,
    },
  });
  const notes = new FakeCollection();
  let seq = 0;
  const connection = {
    startSession: () =>
      Promise.resolve({
        startTransaction: () => {},
        commitTransaction: () => Promise.resolve(),
        abortTransaction: () => Promise.resolve(),
        endSession: () => Promise.resolve(),
      }),
    collection: () => ({
      findOneAndUpdate: () => Promise.resolve({ seq: ++seq }),
    }),
  };
  const service = new CreditNoteService(
    notes as never,
    invoices as never,
    orders as never,
    coupons as never,
    connection as never,
    {
      getSettings: () =>
        Promise.resolve({
          businessAddress: { country: { en: 'Saudi Arabia' } },
        }),
    } as never,
    { clearResources: () => Promise.resolve() } as never,
    {} as never,
    {} as never,
  );
  return { service, notes, orders, invoices, coupons };
}

const admin = {
  reason: 'عميل أرجع جزءاً',
  source: 'admin' as const,
  restock: true,
};

describe('CreditNoteService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('reserves the lines, then numbers the credit note once issued', async () => {
    const { service } = setup();
    const reserved = await service.reserve(
      orderId.toString(),
      [{ itemIndex: 1, quantity: 12 }],
      admin,
    );
    expect(reserved).toMatchObject({
      state: 'awaiting_refund',
      amounts: { total: 227.7, tax: 29.7 },
    });
    expect(reserved?.displayNumber).toBeUndefined();

    const note = await service.issue(reserved!._id, {
      via: 'manual',
      amount: 227.7,
    });
    expect(note.state).toBe('issued');
    expect(note.displayNumber).toMatch(/^RUH-R-8-\d{4}-0001$/);
    expect(note.snapshot).toMatchObject({
      kind: 'credit_note',
      displayNumber: note.displayNumber,
      meta: {
        number: note.displayNumber,
        description:
          'رقم الفاتورة : RUH-8-2026-8554 # تاريخ الفاتورة : 8/19/2026',
      },
      items: [
        {
          index: '1',
          quantity: '12',
          unit: 'حبة',
          price: '16.50 ⃁',
          total: '198 ⃁',
        },
      ],
      summary: { tax: '29.70 ⃁', grandTotal: '227.70 ⃁' },
    });
  });

  it('never returns more than was sold across credit notes', async () => {
    const { service } = setup();
    await service.reserve(
      orderId.toString(),
      [{ itemIndex: 1, quantity: 12 }],
      admin,
    );
    await expect(
      service.reserve(
        orderId.toString(),
        [{ itemIndex: 1, quantity: 9 }],
        admin,
      ),
    ).rejects.toThrow('only 8 left to return');

    const { remaining } = await service.summary(orderId.toString());
    expect(remaining).toEqual([20, 8]);
  });

  it('frees the lines of a void credit note, which never gets a number', async () => {
    const { service, notes } = setup();
    const reserved = await service.reserve(
      orderId.toString(),
      [{ itemIndex: 0, quantity: 20 }],
      admin,
    );
    await service.void(reserved!._id, 'Moyasar declined');

    expect(notes.docs[0]).toMatchObject({ state: 'void' });
    expect(notes.docs[0].creditNoteNumber).toBeUndefined();
    const { remaining } = await service.summary(orderId.toString());
    expect(remaining).toEqual([20, 20]);
    await expect(
      service.issue(reserved!._id, { via: 'manual', amount: 0 }),
    ).rejects.toThrow('cancelled');
  });

  it('issues one credit note per full refund, however often it is recorded', async () => {
    const { service, notes } = setup();
    const meta = {
      ...admin,
      source: 'full_refund' as const,
      idempotencyKey: 'full:t1',
    };
    const first = await service.reserve(orderId.toString(), 'all', meta);
    const again = await service.reserve(orderId.toString(), 'all', meta);

    expect(again?._id).toEqual(first?._id);
    expect(notes.docs).toHaveLength(1);
    expect(first?.amounts).toMatchObject({ total: 759, tax: 99 });
    expect(first?.includesCharges).toBe(true);
  });

  it('has nothing to credit once every line was returned', async () => {
    const { service } = setup();
    await service.reserve(orderId.toString(), 'all', admin);
    await expect(
      service.reserve(orderId.toString(), 'all', admin),
    ).resolves.toBeNull();
  });

  it('reports refunded money no credit note accounts for yet', async () => {
    const { service } = setup({ refundedAmount: 300 });
    expect((await service.summary(orderId.toString())).uncreditedRefund).toBe(
      300,
    );

    const reserved = await service.reserve(
      orderId.toString(),
      [{ itemIndex: 1, quantity: 12 }],
      admin,
    );
    await service.issue(reserved!._id, {
      via: 'already_refunded',
      amount: 227.7,
    });
    expect((await service.summary(orderId.toString())).uncreditedRefund).toBe(
      72.3,
    );
  });

  it('refuses a credit note before the invoice is issued', async () => {
    const { service, invoices } = setup();
    invoices.docs[0].status = 'failed';
    await expect(
      service.reserve(
        orderId.toString(),
        [{ itemIndex: 0, quantity: 1 }],
        admin,
      ),
    ).rejects.toThrow('not issued');
  });
});

describe('CreditNoteService: coupon discount on older orders', () => {
  // The fixture: 2 lines × 20 at 16.50 (660); a 66 coupon on the first one
  const couponId = new Types.ObjectId();
  const withCoupon = (coupon: Record<string, unknown> | null, extra = {}) => {
    const ctx = setup({ couponId, discountAmount: 66, ...extra });
    if (coupon) ctx.coupons.docs.push({ _id: couponId, ...coupon });
    return ctx;
  };
  const firstProduct = (ctx: ReturnType<typeof setup>) =>
    String(ctx.orders.docs[0].items[0].productId);

  it('applies a scoped coupon to the lines it covers, flagged as estimated', async () => {
    const ctx = withCoupon(null);
    ctx.coupons.docs.push({
      _id: couponId,
      applyTo: 'products',
      applyItems: [firstProduct(ctx)],
    });
    const summary = await ctx.service.summary(orderId.toString());
    expect(summary.discountEstimated).toBe(true);

    // The uncovered line gives back no discount
    const preview = await ctx.service.preview(orderId.toString(), [
      { itemIndex: 1, quantity: 10 },
    ]);
    expect(preview.amounts.discount).toBe(0);
    expect(preview.discountEstimated).toBe(true);
  });

  it('needs no estimate for a coupon on the whole order', async () => {
    const ctx = withCoupon({ applyTo: 'all' });
    expect(
      (await ctx.service.summary(orderId.toString())).discountEstimated,
    ).toBe(false);
  });

  it('needs no estimate once checkout froze each line share', async () => {
    const ctx = withCoupon(null);
    ctx.orders.docs[0].items[0].discount = 66;
    ctx.orders.docs[0].items[1].discount = 0;
    const preview = await ctx.service.preview(orderId.toString(), [
      { itemIndex: 1, quantity: 10 },
    ]);
    expect(preview.discountEstimated).toBe(false);
    expect(preview.amounts.discount).toBe(0);
  });

  it('shares by value, flagged, when the coupon is gone', async () => {
    const ctx = withCoupon(null);
    const preview = await ctx.service.preview(orderId.toString(), [
      { itemIndex: 1, quantity: 10 },
    ]);
    expect(preview.discountEstimated).toBe(true);
    // 66 × 165 / 660
    expect(preview.amounts.discount).toBe(16.5);
  });
});
