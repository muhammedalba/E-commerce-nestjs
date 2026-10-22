import { MailProcessor } from './mail.processor';

jest.mock('src/invoice/invoice.service', () => ({ InvoiceService: class {} }));
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
  };
  const invoiceService = {
    generateAndStore: jest.fn(() =>
      Promise.resolve({
        filename: 'RUH-8-2026-0042.pdf',
        buffer: Buffer.from('%PDF-'),
      }),
    ),
    recordCustomerEmail: jest.fn(() => Promise.resolve()),
  };
  const processor = new MailProcessor(
    emailService as never,
    {} as never,
    invoiceService as never,
  );
  const job = {
    name: 'new-order-customer',
    data: jobData,
    attemptsMade,
    opts: { attempts },
  };
  return { processor, job, emailService, invoiceService };
}

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
