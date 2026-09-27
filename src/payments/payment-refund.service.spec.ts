import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PaymentRefundService } from './payment-refund.service';
import { PaymentStatus } from './shared/enums/payment-status.enum';
import { AuditAction } from 'src/audit/shared/schema/audit-log.schema';

// The real imports reach ESM-only `uuid` via settings → file-upload.
jest.mock('./payment-transaction.service', () => ({
  PaymentTransactionService: class {},
}));
jest.mock('./providers/payment-provider.factory', () => ({
  PaymentProviderFactory: class {},
}));

const orderId = new Types.ObjectId().toString();
const admin = { id: 'admin1', email: 'admin@shop.sa' };

const setup = (
  transaction: Record<string, unknown> | null,
  refundPayment: jest.Mock = jest.fn((_id: string, minor: number) =>
    Promise.resolve({
      id: 'pay_1',
      status: 'refunded',
      amount: 10000,
      refunded: minor,
    }),
  ),
) => {
  const tx = transaction && {
    _id: new Types.ObjectId(),
    providerPaymentId: 'pay_1',
    amount: 100,
    currency: 'SAR',
    status: PaymentStatus.PAID,
    ...transaction,
  };
  const findOne = jest.fn(() => ({ sort: () => Promise.resolve(tx) }));
  const processMoyasarRefund = jest.fn(() => Promise.resolve());
  const log = jest.fn(() => Promise.resolve());
  const service = new PaymentRefundService(
    { findOne } as never,
    { getMoyasarProvider: () => ({ refundPayment }) } as never,
    { processMoyasarRefund } as never,
    { log } as never,
  );
  return { service, findOne, refundPayment, processMoyasarRefund, log };
};

describe('PaymentRefundService.refundOrder', () => {
  it('refunds everything left when no amount is given, records it and audits the reason', async () => {
    const { service, refundPayment, processMoyasarRefund, log } = setup({});

    const result = await service.refundOrder(
      orderId,
      { reason: 'Out of stock' },
      admin,
    );

    expect(refundPayment).toHaveBeenCalledWith('pay_1', 10000);
    expect(processMoyasarRefund).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pay_1', refunded: 10000 }),
    );
    expect(result).toEqual({
      refundedNow: 100,
      refundedAmount: 100,
      isFull: true,
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.PAYMENT_REFUNDED,
        userId: 'admin1',
        userEmail: 'admin@shop.sa',
        newData: expect.objectContaining({
          reason: 'Out of stock',
          refundedNow: 100,
        }) as unknown,
      }),
    );
  });

  it('refunds part of what is left after an earlier partial refund', async () => {
    const { service, refundPayment } = setup(
      { status: PaymentStatus.PARTIALLY_REFUNDED, refundedAmount: 25 },
      jest.fn(() =>
        Promise.resolve({
          id: 'pay_1',
          status: 'refunded',
          amount: 10000,
          refunded: 5500,
        }),
      ),
    );

    const result = await service.refundOrder(
      orderId,
      { amount: 30, reason: 'Damaged item' },
      admin,
    );

    expect(refundPayment).toHaveBeenCalledWith('pay_1', 3000);
    expect(result).toEqual({
      refundedNow: 30,
      refundedAmount: 55,
      isFull: false,
    });
  });

  it.each([
    ['more than what is left', { refundedAmount: 80 }, 20.01],
    ['more than was paid', {}, 150],
  ])('rejects an amount %s without calling Moyasar', async (_, tx, amount) => {
    const { service, refundPayment } = setup({
      status: PaymentStatus.PARTIALLY_REFUNDED,
      ...tx,
    });

    await expect(
      service.refundOrder(orderId, { amount, reason: 'x' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(refundPayment).not.toHaveBeenCalled();
  });

  it('rejects an order without a refundable online payment (COD, unpaid, fully refunded)', async () => {
    const { service, refundPayment } = setup(null);

    await expect(
      service.refundOrder(orderId, { reason: 'x' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(refundPayment).not.toHaveBeenCalled();
  });

  it('does not audit or record when Moyasar rejects the refund', async () => {
    const { service, processMoyasarRefund, log } = setup(
      {},
      jest.fn(() =>
        Promise.reject(new BadRequestException('Moyasar rejected the refund')),
      ),
    );

    await expect(
      service.refundOrder(orderId, { reason: 'x' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(processMoyasarRefund).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('still reports success when the money moved but recording failed (the webhook records it)', async () => {
    const { service, processMoyasarRefund, log } = setup({});
    processMoyasarRefund.mockRejectedValueOnce(new Error('db down'));
    jest.spyOn(service['logger'], 'error').mockImplementation();

    await expect(
      service.refundOrder(orderId, { reason: 'x' }, admin),
    ).resolves.toMatchObject({ isFull: true });
    expect(log).toHaveBeenCalled();
  });
});
