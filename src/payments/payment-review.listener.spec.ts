import { PaymentReviewListener } from './payment-review.listener';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';

describe('PaymentReviewListener', () => {
  it('notifies every role that can refund or update orders', async () => {
    const find = jest.fn(() => ({
      select: () => ({
        lean: () => Promise.resolve([{ _id: 'r1' }, { _id: 'r2' }]),
      }),
    }));
    const emit = jest.fn();
    const listener = new PaymentReviewListener(
      { find } as never,
      { emit } as never,
    );
    const payload = { orderId: 'o1', transactionId: 't1', amount: 150 };

    await listener.handlePaymentNeedsReview(payload);

    expect(find).toHaveBeenCalledWith({
      permissions: {
        $in: [Permissions.REFUND_ORDER, Permissions.UPDATE_ORDER_STATUS],
      },
    });
    expect(emit.mock.calls.map(([event]) => event as string)).toEqual([
      'role.notification.r1',
      'role.notification.r2',
    ]);
    expect(emit).toHaveBeenCalledWith(
      'role.notification.r1',
      expect.objectContaining({
        roleId: 'r1',
        action: 'PAYMENT_NEEDS_REVIEW',
        payload,
      }),
    );
  });

  it('never throws out of the event handler', async () => {
    const listener = new PaymentReviewListener(
      {
        find: () => ({
          select: () => ({ lean: () => Promise.reject(new Error('db down')) }),
        }),
      } as never,
      { emit: jest.fn() } as never,
    );
    jest.spyOn(listener['logger'], 'error').mockImplementation();

    await expect(
      listener.handlePaymentNeedsReview({
        orderId: 'o1',
        transactionId: 't1',
        amount: 1,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('PaymentReviewListener payment.refunded', () => {
  const setup = () => {
    const find = jest.fn(() => ({
      select: () => ({ lean: () => Promise.resolve([{ _id: 'r1' }]) }),
    }));
    const emit = jest.fn();
    const listener = new PaymentReviewListener(
      { find } as never,
      { emit } as never,
    );
    return { listener, emit };
  };
  const refund = (isFull: boolean, refundedAmount: number) => ({
    orderId: 'o1',
    transactionId: 't1',
    refundedAmount,
    currency: 'SAR',
    isFull,
  });

  it('tells order managers about a full refund', async () => {
    const { listener, emit } = setup();

    await listener.handlePaymentRefunded(refund(true, 100));

    expect(emit).toHaveBeenCalledWith(
      'role.notification.r1',
      expect.objectContaining({
        action: 'PAYMENT_REFUNDED',
        message: {
          ar: 'تم استرداد مبلغ الطلب o1 بالكامل (100 SAR).',
          en: 'Order o1 was fully refunded (100 SAR).',
        },
      }),
    );
  });

  it('gives the cumulative total for a partial refund', async () => {
    const { listener, emit } = setup();

    await listener.handlePaymentRefunded(refund(false, 60));

    expect(emit).toHaveBeenCalledWith(
      'role.notification.r1',
      expect.objectContaining({
        message: expect.objectContaining({
          en: 'Part of order o1 was refunded. Total refunded so far: 60 SAR.',
        }) as unknown,
      }),
    );
  });
});
