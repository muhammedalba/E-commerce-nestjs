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
