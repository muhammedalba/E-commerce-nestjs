import { PaymentRefundsController } from './payment-refunds.controller';

// Real imports reach ESM-only `uuid`; the controller only needs DI tokens.
jest.mock('./payment-refund.service', () => ({
  PaymentRefundService: class {},
}));
jest.mock('src/auth/shared/guards/auth.guard', () => ({
  AuthGuard: class {},
}));
jest.mock('src/roles/shared/guards/permissions.guard', () => ({
  PermissionsGuard: class {},
}));

describe('PaymentRefundsController', () => {
  it('audits the refund under req.user.user_id (the JwtPayload id)', async () => {
    const refundOrder = jest.fn(() => Promise.resolve({}));
    const controller = new PaymentRefundsController({ refundOrder } as never);

    await controller.refundOrder(
      { orderId: 'o1' },
      { amount: 10, reason: 'Damaged' },
      { user: { user_id: 'admin1', email: 'admin@shop.sa' } } as never,
    );

    expect(refundOrder).toHaveBeenCalledWith(
      'o1',
      { amount: 10, reason: 'Damaged' },
      { id: 'admin1', email: 'admin@shop.sa' },
    );
  });
});
