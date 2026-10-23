import { Types } from 'mongoose';

// Pulls in sharp and the ESM-only uuid through its services; unused here
jest.mock('src/settings/settings.service', () => ({
  SettingsService: class {},
}));

import { InvoiceQueryService } from './invoice-query.service';

const query = <T>(value: T) => {
  const q = {
    select: () => q,
    limit: () => q,
    lean: () => Promise.resolve(value),
  };
  return q;
};

const invoiceRow = (n: number, total: number, credited = 0) => ({
  displayNumber: `RUH-8-2026-${String(n).padStart(4, '0')}`,
  invoiceNumber: n,
  issuedAt: new Date('2026-10-21T22:30:00.000Z'),
  status: 'generated',
  customer: { name: 'محمد, البحلي', vatNo: '' },
  amounts: {
    taxableSubtotal: total / 1.15,
    tax: total - total / 1.15,
    grandTotal: total,
  },
  credited: { count: credited ? 1 : 0, total: credited },
});

function setup({
  users = [] as { _id: Types.ObjectId }[],
  orders = [] as { _id: Types.ObjectId }[],
  aggregate = [] as unknown[],
} = {}) {
  const invoiceModel = {
    aggregate: jest.fn(() => Promise.resolve(aggregate)),
    countDocuments: jest.fn(() => Promise.resolve(aggregate.length)),
    find: jest.fn(() => query([])),
    collection: { name: 'invoices' },
  };
  const creditNoteModel = {
    aggregate: jest.fn(() => Promise.resolve(aggregate)),
    countDocuments: jest.fn(() => Promise.resolve(aggregate.length)),
    collection: { name: 'creditnotes' },
  };
  const orderModel = { find: jest.fn(() => query(orders)) };
  const userModel = { find: jest.fn(() => query(users)) };
  const settingsService = {
    getSettings: jest.fn(() => Promise.resolve({ businessAddress: null })),
  };
  const service = new InvoiceQueryService(
    invoiceModel as never,
    creditNoteModel as never,
    orderModel as never,
    userModel as never,
    settingsService as never,
  );
  return { service, invoiceModel, creditNoteModel, userModel, orderModel };
}

/** The $match stage of the first aggregate call. */
const matchOf = (model: { aggregate: jest.Mock }) =>
  (model.aggregate.mock.calls[0] as [{ $match?: unknown }[]])[0][0].$match;

describe('InvoiceQueryService: search and filters', () => {
  it('searches the number, the customer name and the order number', async () => {
    const ctx = setup();
    await ctx.service.listInvoices({ search: '42' });
    const match = matchOf(ctx.invoiceModel) as { $or: object[] };
    expect(match.$or).toEqual([
      { displayNumber: /42/i },
      { 'snapshot.customer.name': /42/i },
      { invoiceNumber: 42 },
    ]);
  });

  it("finds a customer's invoices by email or phone", async () => {
    const order = new Types.ObjectId();
    const ctx = setup({
      users: [{ _id: new Types.ObjectId() }],
      orders: [{ _id: order }],
    });
    await ctx.service.listInvoices({ search: 'ali@example.com' });
    const match = matchOf(ctx.invoiceModel) as { $or: object[] };
    expect(match.$or).toContainEqual({ order: { $in: [order] } });
  });

  it('escapes the search: it is text, not a pattern', async () => {
    const ctx = setup();
    await ctx.service.listInvoices({ search: 'a.*(' });
    const match = matchOf(ctx.invoiceModel) as {
      $or: { displayNumber?: RegExp }[];
    };
    expect(match.$or[0].displayNumber?.source).toBe('a\\.\\*\\(');
  });

  it('filters by status and issue date', async () => {
    const ctx = setup();
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-31T23:59:59.999Z');
    await ctx.service.listInvoices({ status: 'failed', from, to });
    expect(matchOf(ctx.invoiceModel)).toEqual({
      issuedAt: { $gte: from, $lte: to },
      status: { $in: ['failed', 'pending', 'generating'] },
    });
  });

  it('lists issued credit notes by default; older ones count as defect', async () => {
    const ctx = setup();
    await ctx.service.listCreditNotes({ reasonType: 'defect' });
    expect(matchOf(ctx.creditNoteModel)).toEqual({
      state: 'issued',
      reasonType: { $ne: 'other' },
    });
  });

  it('pages for the response interceptor', async () => {
    const ctx = setup({ aggregate: [invoiceRow(1, 115)] });
    const page = await ctx.service.listInvoices({ page: 2, limit: 1 });
    expect(page).toMatchObject({
      results: 1,
      pagination: { currentPage: 2, limit: 1, numberOfPages: 1 },
    });
  });
});

describe('InvoiceQueryService: file links', () => {
  it('serves the PDF from the API server, not the storefront', async () => {
    const ctx = setup({
      aggregate: [
        {
          ...invoiceRow(42, 115),
          file: {
            url: '/uploads/Invoice/a.pdf',
            publicId: 'a',
            provider: 'local',
          },
        },
      ],
    });
    const page = await ctx.service.listInvoices({});
    expect((page.data[0] as { file: { url: string } }).file.url).toBe(
      `${process.env.BASE_URL || 'http://localhost:4000'}/uploads/Invoice/a.pdf`,
    );
  });
});

describe('InvoiceQueryService.stats', () => {
  it('nets the credit notes off the invoices', async () => {
    const ctx = setup();
    ctx.invoiceModel.aggregate.mockResolvedValueOnce([
      { count: 2, total: 690, tax: 90 },
    ]);
    ctx.creditNoteModel.aggregate.mockResolvedValueOnce([
      { count: 1, total: 345, tax: 45 },
    ]);
    ctx.invoiceModel.countDocuments.mockResolvedValueOnce(1);
    ctx.creditNoteModel.countDocuments.mockResolvedValueOnce(0);

    expect(await ctx.service.stats({})).toEqual({
      invoices: { count: 2, total: 690, tax: 90 },
      creditNotes: { count: 1, total: 345, tax: 45 },
      net: { total: 345, tax: 45 },
      failed: { invoices: 1, creditNotes: 0 },
    });
  });

  it('is all zeros for an empty period', async () => {
    const ctx = setup();
    const stats = await ctx.service.stats({});
    expect(stats.net).toEqual({ total: 0, tax: 0 });
    expect(stats.invoices.count).toBe(0);
  });
});

describe('InvoiceQueryService.exportCsv', () => {
  it('writes the invoices, store-timezone dates and a totals row', async () => {
    const ctx = setup({
      aggregate: [invoiceRow(42, 115, 57.5), invoiceRow(43, 230)],
    });
    const csv = await ctx.service.exportCsv('invoices', {});
    const lines = csv.slice(1).trim().split('\r\n');

    expect(lines[0].startsWith('رقم الفاتورة,التاريخ,رقم الطلب')).toBe(true);
    // 2026-10-21 22:30 UTC is the 22nd in Riyadh; the comma is quoted
    expect(lines[1]).toContain('RUH-8-2026-0042,2026-10-22,42,"محمد, البحلي"');
    expect(lines[3]).toMatch(/^الإجمالي,,,2,,300,45,345,57.5,$/);
  });

  it('writes the credit notes with the reason and the refund', async () => {
    const ctx = setup({
      aggregate: [
        {
          displayNumber: 'RUH-R-8-2026-0001',
          issuedAt: new Date('2026-10-22T09:00:00.000Z'),
          reasonType: 'other',
          invoice: { displayNumber: 'RUH-8-2026-0042' },
          customer: { name: 'محمد' },
          amounts: { taxable: 300, tax: 45, total: 345 },
          deductions: { returnShipping: { total: 28.75 } },
          refund: { via: 'moyasar', amount: 316.25 },
        },
      ],
    });
    const csv = await ctx.service.exportCsv('credit-notes', {});
    expect(csv).toContain(
      'RUH-R-8-2026-0001,2026-10-22,RUH-8-2026-0042,محمد,أسباب أخرى,300,45,345,28.75,316.25,ميسر',
    );
  });
});
