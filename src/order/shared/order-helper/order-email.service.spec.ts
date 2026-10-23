import { Types } from 'mongoose';
import { OrderEmailService } from './order-email.service';

// Pulled in through SettingsService (sharp, the ESM-only uuid); unused here
jest.mock('src/file-upload/file-upload.service', () => ({
  FileUploadService: class {},
}));

const order = (paymentStatus: string) =>
  ({
    _id: new Types.ObjectId(),
    invoiceNumber: 42,
    paymentStatus,
    currency: 'SAR',
    grandTotal: 115,
    totalPrice: 100,
    createdAt: new Date('2026-10-22T08:00:00Z'),
    items: [],
  }) as never;

function setup() {
  const mailQueue = { add: jest.fn(() => Promise.resolve()) };
  const service = new OrderEmailService(
    mailQueue as never,
    { translate: (key: string) => key } as never,
    { getSettings: () => Promise.resolve(null) } as never,
  );
  return { service, mailQueue };
}

const customer = { email: 'a@b.c', name: 'Ali' };

describe('OrderEmailService: the invoice is issued on payment', () => {
  it('confirms an unpaid order (COD, transfer) without its invoice', async () => {
    const { service, mailQueue } = setup();
    await service.sendCustomerOrderEmail(order('PENDING'), customer);
    expect(mailQueue.add).toHaveBeenCalledWith(
      'new-order-customer',
      expect.objectContaining({ orderMongoId: undefined }),
    );
  });

  it('attaches the invoice to a paid order (Moyasar) confirmation', async () => {
    const { service, mailQueue } = setup();
    const paid = order('PAID');
    await service.sendCustomerOrderEmail(paid, customer);
    expect(mailQueue.add).toHaveBeenCalledWith(
      'new-order-customer',
      expect.objectContaining({
        orderMongoId: (paid as { _id: Types.ObjectId })._id.toString(),
      }),
    );
  });

  it('queues the payment email with the invoice to issue', async () => {
    const { service, mailQueue } = setup();
    const paid = order('PAID');
    await service.sendPaymentReceivedEmail(paid, customer);
    expect(mailQueue.add).toHaveBeenCalledWith(
      'payment-received-customer',
      expect.objectContaining({
        email: 'a@b.c',
        orderId: '0042',
        amount: '115',
        orderMongoId: (paid as { _id: Types.ObjectId })._id.toString(),
        subject: 'email.PAYMENT_RECEIVED_SUBJECT',
      }),
    );
  });
});
