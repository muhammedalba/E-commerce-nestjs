/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { InvoiceBusyError, InvoiceService } from './invoice.service';

jest.mock('src/file-upload/file-upload.service', () => ({
  FileUploadService: class {},
}));

/**
 * Just enough of a Mongo collection for the queries InvoiceService runs:
 * every operation is atomic, like in Mongo, so concurrent calls interleave
 * between awaits the way two mail workers would.
 */
class FakeCollection {
  docs: any[] = [];

  private matches(doc: any, filter: any): boolean {
    return Object.entries(filter).every(([key, cond]: [string, any]) => {
      if (key === '$or') return cond.some((f: any) => this.matches(doc, f));
      const value = doc[key];
      if (
        cond &&
        typeof cond === 'object' &&
        !(cond instanceof Types.ObjectId) &&
        !(cond instanceof Date)
      ) {
        if ('$ne' in cond) return value !== cond.$ne;
        if ('$lt' in cond) return value != null && value < cond.$lt;
        if ('$exists' in cond) return (value !== undefined) === cond.$exists;
      }
      if (cond === null) return value == null;
      return String(value) === String(cond);
    });
  }

  private apply(doc: any, update: any, inserting: boolean) {
    if (inserting) Object.assign(doc, update.$setOnInsert);
    Object.assign(doc, update.$set);
    for (const key of Object.keys(update.$unset ?? {})) delete doc[key];
    for (const [key, n] of Object.entries<number>(update.$inc ?? {})) {
      doc[key] = (doc[key] ?? 0) + n;
    }
  }

  private query(result: any) {
    const q: any = {
      populate: () => q,
      select: () => q,
      lean: () => q,
      then: (ok: any, ko: any) =>
        Promise.resolve(result && { ...result }).then(ok, ko),
    };
    return q;
  }

  findOne = (filter: any) =>
    this.query(this.docs.find((d) => this.matches(d, filter)));

  findById = (id: any) => this.findOne({ _id: id });

  findOneAndUpdate = (filter: any, update: any, opts: any = {}) => {
    let doc = this.docs.find((d) => this.matches(d, filter));
    const inserting = !doc && opts.upsert;
    if (inserting) {
      doc = { _id: new Types.ObjectId(), ...filter };
      this.docs.push(doc);
    }
    if (doc) this.apply(doc, update, inserting);
    return this.query(doc);
  };

  updateOne = (filter: any, update: any) => {
    const doc = this.docs.find((d) => this.matches(d, filter));
    if (doc) this.apply(doc, update, false);
    return Promise.resolve({
      matchedCount: doc ? 1 : 0,
      modifiedCount: doc ? 1 : 0,
    });
  };
}

const orderId = new Types.ObjectId().toString();
const order = {
  _id: orderId,
  invoiceNumber: 42,
  createdAt: '2026-10-21T21:30:00.000Z',
  totalPrice: 100,
  taxAmount: 15,
  grandTotal: 115,
  shippingAddress: { firstName: 'Ali', lastName: 'Hassan' },
  items: [{ title: { ar: 'منتج', en: 'Item' }, quantity: 1, price: 100 }],
};
const settings = {
  legalName: { ar: 'شركة', en: 'Company' },
  businessAddress: { vatNo: '300000000000003' },
};
const PDF = Buffer.from('%PDF-1.7 fake invoice');

function setup(storeSettings: object = settings) {
  const invoices = new FakeCollection();
  const orders = new FakeCollection();
  orders.docs.push({ ...order, _id: new Types.ObjectId(orderId) });

  const stored = new Map<string, Buffer>();
  let uploads = 0;
  const fileUploadService = {
    saveFileToDisk: jest.fn((file: { buffer: Buffer }) => {
      const url = `https://cdn.test/Invoice/${++uploads}.pdf`;
      stored.set(url, file.buffer);
      return Promise.resolve({ url, publicId: url, provider: 'cloudinary' });
    }),
    deleteFile: jest.fn((asset: { url: string }) => {
      stored.delete(asset.url);
      return Promise.resolve();
    }),
  };
  const renderer = {
    render: jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return PDF;
    }),
  };
  global.fetch = jest.fn((url: string) => {
    const body = stored.get(url);
    return Promise.resolve({
      ok: !!body,
      status: body ? 200 : 404,
      arrayBuffer: () => Promise.resolve(body ?? Buffer.alloc(0)),
    });
  }) as any;

  const service = new InvoiceService(
    invoices as any,
    orders as any,
    { getSettings: () => Promise.resolve(storeSettings) } as any,
    fileUploadService as any,
    { clearResources: jest.fn(() => Promise.resolve()) } as any,
    renderer,
  );
  return { service, invoices, orders, fileUploadService, renderer, stored };
}

describe('InvoiceService.generateAndStore', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('gives up on a remote logo that does not answer and uses the default', async () => {
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    // The real limit is 10 s; let it fire after 20 ms here
    const timeout = jest
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => realTimeout(20));
    const { service } = setup({
      ...settings,
      logo: 'https://cdn.test/logo-that-hangs.png',
    });
    const answer = global.fetch as jest.Mock;
    const stalled = jest.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('The operation was aborted due to timeout')),
          ),
        ),
    );
    global.fetch = jest.fn((url: string, init?: { signal?: AbortSignal }) =>
      url.includes('logo-that-hangs')
        ? stalled(url, init)
        : (answer(url) as Promise<unknown>),
    ) as any;
    const warn = jest.spyOn(Logger.prototype, 'warn');

    const issued = await service.generateAndStore(orderId);

    expect(issued.buffer.equals(PDF)).toBe(true);
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(stalled).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'logo-that-hangs.png unreadable, using the default',
      ),
    );
  });

  it('issues, stores and mirrors the invoice on the order', async () => {
    const { service, invoices, orders, fileUploadService } = setup();
    const issued = await service.generateAndStore(orderId);

    expect(issued.buffer.equals(PDF)).toBe(true);
    expect(issued.filename).toBe('RUH-8-2026-0042.pdf');
    expect(fileUploadService.saveFileToDisk).toHaveBeenCalledTimes(1);
    const [record] = invoices.docs;
    expect(record).toMatchObject({
      status: 'generated',
      invoiceNumber: 42,
      displayNumber: 'RUH-8-2026-0042',
      file: issued.file,
      fileSize: PDF.length,
      attempts: 1,
    });
    expect(record.lockId).toBeUndefined();
    expect(orders.docs[0].InvoicePdf).toEqual(issued.file);
  });

  it('returns the stored file on a retry, without a second render or upload', async () => {
    const { service, fileUploadService, renderer } = setup();
    const first = await service.generateAndStore(orderId);
    const again = await service.generateAndStore(orderId);

    expect(again.file).toEqual(first.file);
    expect(again.buffer.equals(first.buffer)).toBe(true);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(fileUploadService.saveFileToDisk).toHaveBeenCalledTimes(1);
  });

  it('issues one invoice when two jobs run at once', async () => {
    const { service, invoices, fileUploadService } = setup();
    const results = await Promise.allSettled([
      service.generateAndStore(orderId),
      service.generateAndStore(orderId),
    ]);

    expect(invoices.docs).toHaveLength(1);
    expect(fileUploadService.saveFileToDisk).toHaveBeenCalledTimes(1);
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(rejected).toHaveLength(1);
    // The loser retries later (mail-queue backoff) and gets the same file
    expect(rejected[0].reason).toBeInstanceOf(InvoiceBusyError);
    const retry = await service.generateAndStore(orderId);
    expect(retry.file).toEqual(invoices.docs[0].file);
  });

  it('keeps the winner and drops its own file when its lease was taken over', async () => {
    const { service, invoices, fileUploadService, renderer, stored } = setup();
    const winner = { url: 'https://cdn.test/Invoice/winner.pdf' };
    stored.set(winner.url, PDF);
    renderer.render.mockImplementationOnce(() => {
      // While rendering, the lease expires and another worker issues it
      Object.assign(invoices.docs[0], {
        lockId: 'someone-else',
        status: 'generated',
        file: winner,
      });
      return Promise.resolve(PDF);
    });

    const issued = await service.generateAndStore(orderId);
    expect(issued.file).toEqual(winner);
    expect(fileUploadService.deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://cdn.test/Invoice/1.pdf' }),
    );
  });

  it('records a failure and keeps the number for the next attempt', async () => {
    const { service, invoices, renderer, fileUploadService } = setup();
    renderer.render.mockRejectedValueOnce(new Error('typst exploded'));

    await expect(service.generateAndStore(orderId)).rejects.toThrow(
      'typst exploded',
    );
    expect(invoices.docs[0]).toMatchObject({
      status: 'failed',
      lastError: 'typst exploded',
      displayNumber: 'RUH-8-2026-0042',
    });
    expect(invoices.docs[0].lockId).toBeUndefined();
    expect(fileUploadService.saveFileToDisk).not.toHaveBeenCalled();

    const issued = await service.regenerate(orderId);
    expect(issued.displayNumber).toBe('RUH-8-2026-0042');
    expect(invoices.docs).toHaveLength(1);
    expect(invoices.docs[0]).toMatchObject({
      status: 'generated',
      attempts: 2,
    });
  });

  it('renders a retry from the frozen data, not the current order', async () => {
    const { service, orders, renderer } = setup();
    renderer.render.mockRejectedValueOnce(new Error('first try fails'));
    await expect(service.generateAndStore(orderId)).rejects.toThrow();

    orders.docs[0].grandTotal = 999; // changed after the invoice was issued
    await service.generateAndStore(orderId);
    const [[snapshot]] = renderer.render.mock.calls.slice(-1) as any;
    expect(snapshot.amounts.grandTotal).toBe(115);
  });

  it('does not overwrite a file an admin already put on the order', async () => {
    const { service, orders, invoices } = setup();
    const manual = { url: '/uploads/Order/manual.pdf' };
    orders.docs[0].InvoicePdf = manual;

    await service.generateAndStore(orderId);
    expect(orders.docs[0].InvoicePdf).toEqual(manual);
    expect(invoices.docs[0].status).toBe('generated');
  });

  it('refuses to regenerate an issued invoice', async () => {
    const { service } = setup();
    await service.generateAndStore(orderId);
    await expect(service.regenerate(orderId)).rejects.toThrow(
      'Invoice already issued',
    );
  });

  it('knows the issued file, with or without the base URL', async () => {
    const { service } = setup();
    const issued = await service.generateAndStore(orderId);
    await expect(
      service.isIssuedInvoiceFile(orderId, issued.file),
    ).resolves.toBe(true);
    await expect(
      service.isIssuedInvoiceFile(orderId, {
        url: '/uploads/Order/x.pdf',
      } as any),
    ).resolves.toBe(false);
  });

  it('records the confirmation email apart from the issuing state', async () => {
    const { service, invoices } = setup();
    await service.generateAndStore(orderId);
    await service.recordCustomerEmail(orderId, true, '<id@smtp>');
    expect(invoices.docs[0]).toMatchObject({
      status: 'generated',
      customerEmail: { status: 'smtp_accepted', messageId: '<id@smtp>' },
    });
  });
});
