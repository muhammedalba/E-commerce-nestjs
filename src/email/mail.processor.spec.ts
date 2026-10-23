import { DelayedError } from 'bullmq';
import { MailProcessor } from './mail.processor';

jest.mock('src/invoice/invoice.service', () => ({ InvoiceService: class {} }));
jest.mock('src/invoice/credit-note.service', () => ({
  CreditNoteService: class {},
}));
jest.mock('src/notifications/notifications.service', () => ({
  NotificationsService: class {},
}));

const data = {
  email: 'customer@example.com',
  name: 'Ali',
  orderId: '0042',
  date: 'Oct 22, 2026',
  amount: '115',
  currency: 'SAR',
  orderDetails: [],
  orderUrl: 'https://shop.test/ar/account/orders/abc',
  subject: 'Order 0042',
  lang: 'ar',
  orderMongoId: '66f1a2b3c4d5e6f7a8b9c0d1',
};

function setup(attemptsMade = 0, attempts = 3, jobData: object = data) {
  const emailService = {
    send_order_confirmation: jest.fn(() =>
      Promise.resolve({ messageId: '<m@smtp>' }),
    ),
    send_credit_note: jest.fn(() => Promise.resolve({ messageId: '<c@smtp>' })),
    send_payment_received: jest.fn(() =>
      Promise.resolve({ messageId: '<p@smtp>' }),
    ),
  };
  const creditNoteService = {
    generateAndStore: jest.fn(() =>
      Promise.resolve({
        filename: 'RUH-R-8-2026-0001.pdf',
        buffer: Buffer.from('%PDF-'),
      }),
    ),
    recordCustomerEmail: jest.fn(() => Promise.resolve()),
  };
  const invoiceService = {
    generateAndStore: jest.fn(() =>
      Promise.resolve({
        filename: 'RUH-8-2026-0042.pdf',
        buffer: Buffer.from('%PDF-'),
      }),
    ),
    recordCustomerEmail: jest.fn(() => Promise.resolve()),
    wasEmailed: jest.fn(() => Promise.resolve(false)),
  };
  const processor = new MailProcessor(
    emailService as never,
    {} as never,
    invoiceService as never,
    creditNoteService as never,
  );
  const job = {
    id: '68',
    name: 'new-order-customer',
    data: jobData,
    attemptsMade,
    opts: { attempts },
    updateData: jest.fn((next: object) => {
      job.data = next;
      return Promise.resolve();
    }),
    moveToDelayed: jest.fn(() => Promise.resolve()),
  };
  return { processor, job, emailService, invoiceService, creditNoteService };
}

describe('MailProcessor credit-note-customer', () => {
  const creditData = {
    email: 'customer@example.com',
    name: 'Ali',
    creditNoteId: '66f1a2b3c4d5e6f7a8b9c0d9',
    creditNoteNumber: 'RUH-R-8-2026-0001',
    orderNumber: '0042',
    total: '227.7',
    currency: 'SAR',
    orderUrl: 'https://shop.test/ar/account/orders/abc',
    subject: 'Credit note',
    lang: 'ar',
  };
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('attaches the credit note PDF and records the email', async () => {
    const { processor, job, emailService, creditNoteService } = setup(
      0,
      3,
      creditData,
    );
    job.name = 'credit-note-customer';
    await processor.process(job as never);
    expect(creditNoteService.generateAndStore).toHaveBeenCalledWith(
      creditData.creditNoteId,
    );
    expect(emailService.send_credit_note).toHaveBeenCalledWith(creditData, {
      filename: 'RUH-R-8-2026-0001.pdf',
      content: Buffer.from('%PDF-'),
    });
    expect(creditNoteService.recordCustomerEmail).toHaveBeenCalledWith(
      creditData.creditNoteId,
      true,
      '<c@smtp>',
    );
  });

  it('retries a failed PDF, then sends without it on the last attempt', async () => {
    const first = setup(0, 2, creditData);
    first.job.name = 'credit-note-customer';
    first.creditNoteService.generateAndStore.mockRejectedValueOnce(
      new Error('down'),
    );
    await expect(first.processor.process(first.job as never)).rejects.toThrow(
      'down',
    );
    expect(first.emailService.send_credit_note).not.toHaveBeenCalled();

    const last = setup(1, 2, creditData);
    last.job.name = 'credit-note-customer';
    last.creditNoteService.generateAndStore.mockRejectedValueOnce(
      new Error('down'),
    );
    await last.processor.process(last.job as never);
    expect(last.emailService.send_credit_note).toHaveBeenCalledWith(
      creditData,
      undefined,
    );
  });
});

describe('MailProcessor new-order-customer', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('attaches the issued invoice to the confirmation', async () => {
    const { processor, job, emailService, invoiceService } = setup();
    await processor.process(job as never);

    expect(invoiceService.generateAndStore).toHaveBeenCalledWith(
      data.orderMongoId,
    );
    expect(emailService.send_order_confirmation).toHaveBeenCalledWith(data, {
      filename: 'RUH-8-2026-0042.pdf',
      content: Buffer.from('%PDF-'),
    });
    expect(invoiceService.recordCustomerEmail).toHaveBeenCalledWith(
      data.orderMongoId,
      true,
      '<m@smtp>',
    );
  });

  it('fails the job while retries remain, sending nothing', async () => {
    const { processor, job, emailService, invoiceService } = setup(0, 3);
    invoiceService.generateAndStore.mockRejectedValueOnce(new Error('down'));

    await expect(processor.process(job as never)).rejects.toThrow('down');
    expect(emailService.send_order_confirmation).not.toHaveBeenCalled();
  });

  it('sends the confirmation without the invoice on the last attempt', async () => {
    const { processor, job, emailService, invoiceService } = setup(2, 3);
    invoiceService.generateAndStore.mockRejectedValueOnce(new Error('down'));

    await processor.process(job as never);
    expect(emailService.send_order_confirmation).toHaveBeenCalledWith(
      data,
      undefined,
    );
    expect(invoiceService.recordCustomerEmail).toHaveBeenCalledWith(
      data.orderMongoId,
      false,
      '<m@smtp>',
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(data.orderMongoId),
    );
  });

  describe('while another worker issues the invoice', () => {
    const busy = () =>
      Object.assign(new Error('Invoice is being generated by another worker'), {
        name: 'InvoiceBusyError',
      });
    beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));

    it('waits 15 s without using an attempt, sending nothing', async () => {
      // Even on the last attempt: waiting must not send it without the PDF
      const { processor, job, emailService, invoiceService } = setup(2, 3);
      invoiceService.generateAndStore.mockRejectedValueOnce(busy());
      const before = Date.now();

      await expect(processor.process(job as never, 'tok')).rejects.toThrow(
        DelayedError,
      );
      expect(job.updateData).toHaveBeenCalledWith({ ...data, pdfWaits: 1 });
      const [until, token] = job.moveToDelayed.mock.calls[0] as unknown as [
        number,
        string,
      ];
      expect(token).toBe('tok');
      expect(until - before).toBeGreaterThanOrEqual(15_000);
      expect(emailService.send_order_confirmation).not.toHaveBeenCalled();
    });

    it('attaches the invoice once the other worker has issued it', async () => {
      const { processor, job, emailService, invoiceService } = setup(0, 3, {
        ...data,
        pdfWaits: 3,
      });
      await processor.process(job as never, 'tok');
      expect(invoiceService.generateAndStore).toHaveBeenCalledTimes(1);
      expect(emailService.send_order_confirmation).toHaveBeenCalledWith(
        { ...data, pdfWaits: 3 },
        { filename: 'RUH-8-2026-0042.pdf', content: Buffer.from('%PDF-') },
      );
    });

    it('stops waiting after 10 waits and falls back to the attempts', async () => {
      const { processor, job, emailService, invoiceService } = setup(2, 3, {
        ...data,
        pdfWaits: 10,
      });
      invoiceService.generateAndStore.mockRejectedValueOnce(busy());

      await processor.process(job as never, 'tok');
      expect(job.moveToDelayed).not.toHaveBeenCalled();
      expect(emailService.send_order_confirmation).toHaveBeenCalledWith(
        { ...data, pdfWaits: 10 },
        undefined,
      );
    });

    it('uses the attempts as before when the worker token is unknown', async () => {
      const { processor, job, invoiceService } = setup(0, 3);
      invoiceService.generateAndStore.mockRejectedValueOnce(busy());

      await expect(processor.process(job as never)).rejects.toThrow(
        'another worker',
      );
      expect(job.moveToDelayed).not.toHaveBeenCalled();
    });

    it('waits for a credit note being issued too', async () => {
      const { processor, job, creditNoteService } = setup(0, 3, {
        ...data,
        creditNoteId: '66f1a2b3c4d5e6f7a8b9c0d9',
      });
      job.name = 'credit-note-customer';
      creditNoteService.generateAndStore.mockRejectedValueOnce(
        Object.assign(new Error('busy'), { name: 'CreditNoteBusyError' }),
      );
      await expect(processor.process(job as never, 'tok')).rejects.toThrow(
        DelayedError,
      );
      expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
    });
  });

  it('retries a failed send with the stored invoice (no second issue)', async () => {
    const { processor, job, emailService, invoiceService } = setup(0, 3);
    emailService.send_order_confirmation.mockRejectedValueOnce(
      new Error('SMTP 421'),
    );

    await expect(processor.process(job as never)).rejects.toThrow('SMTP 421');
    job.attemptsMade = 1;
    await processor.process(job as never);
    // generateAndStore returns the stored file on the second call; the
    // service itself guarantees no second render (invoice.service.spec)
    expect(invoiceService.generateAndStore).toHaveBeenCalledTimes(2);
    expect(emailService.send_order_confirmation).toHaveBeenCalledTimes(2);
  });

  it('still succeeds when the email record cannot be saved', async () => {
    const { processor, job, invoiceService } = setup();
    invoiceService.recordCustomerEmail.mockRejectedValueOnce(
      new Error('db down'),
    );
    await expect(processor.process(job as never)).resolves.toEqual({});
  });

  it('sends jobs queued before invoices existed as before', async () => {
    const oldData: Partial<typeof data> = { ...data };
    delete oldData.orderMongoId;
    const { processor, job, emailService, invoiceService } = setup(
      0,
      3,
      oldData,
    );
    await processor.process(job as never);
    expect(invoiceService.generateAndStore).not.toHaveBeenCalled();
    expect(emailService.send_order_confirmation).toHaveBeenCalledWith(
      oldData,
      undefined,
    );
  });
});

describe('MailProcessor payment-received-customer', () => {
  const paymentData = {
    email: 'customer@example.com',
    name: 'Ali',
    orderId: '0042',
    amount: '115',
    currency: 'SAR',
    orderUrl: 'https://shop.test/ar/account/orders/abc',
    subject: 'Payment received',
    lang: 'ar',
    orderMongoId: '66f1a2b3c4d5e6f7a8b9c0d1',
  };
  const paymentJob = (attemptsMade = 0, attempts = 3) => {
    const ctx = setup(attemptsMade, attempts, paymentData);
    ctx.job.name = 'payment-received-customer';
    return ctx;
  };
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('issues the invoice on payment and emails it', async () => {
    const { processor, job, emailService, invoiceService } = paymentJob();
    await processor.process(job as never);

    expect(invoiceService.generateAndStore).toHaveBeenCalledWith(
      paymentData.orderMongoId,
    );
    expect(emailService.send_payment_received).toHaveBeenCalledWith(
      paymentData,
      { filename: 'RUH-8-2026-0042.pdf', content: Buffer.from('%PDF-') },
    );
    expect(invoiceService.recordCustomerEmail).toHaveBeenCalledWith(
      paymentData.orderMongoId,
      true,
      '<p@smtp>',
    );
  });

  it('sends nothing when the invoice was already emailed', async () => {
    const { processor, job, emailService, invoiceService } = paymentJob();
    invoiceService.wasEmailed.mockResolvedValueOnce(true);
    await processor.process(job as never);

    expect(invoiceService.generateAndStore).not.toHaveBeenCalled();
    expect(emailService.send_payment_received).not.toHaveBeenCalled();
  });

  it('sends it again when the dashboard resends the invoice', async () => {
    const { processor, job, emailService, invoiceService } = paymentJob();
    job.data = { ...paymentData, resend: true };
    invoiceService.wasEmailed.mockResolvedValueOnce(true);
    await processor.process(job as never);

    expect(invoiceService.wasEmailed).not.toHaveBeenCalled();
    expect(emailService.send_payment_received).toHaveBeenCalledWith(
      { ...paymentData, resend: true },
      { filename: 'RUH-8-2026-0042.pdf', content: Buffer.from('%PDF-') },
    );
  });

  it('retries a failed invoice, then confirms the payment without it', async () => {
    const first = paymentJob(0, 2);
    first.invoiceService.generateAndStore.mockRejectedValueOnce(
      new Error('down'),
    );
    await expect(first.processor.process(first.job as never)).rejects.toThrow(
      'down',
    );
    expect(first.emailService.send_payment_received).not.toHaveBeenCalled();

    const last = paymentJob(1, 2);
    last.invoiceService.generateAndStore.mockRejectedValueOnce(
      new Error('down'),
    );
    await last.processor.process(last.job as never);
    expect(last.emailService.send_payment_received).toHaveBeenCalledWith(
      paymentData,
      undefined,
    );
  });
});
