import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentTransactionsController } from './payment-transactions.controller';

// Real imports reach ESM-only `uuid` via settings → file-upload; the controller
// only needs these as DI tokens.
jest.mock('./payment-transaction.service', () => ({
  PaymentTransactionService: class {},
}));
jest.mock('./providers/payment-provider.factory', () => ({
  PaymentProviderFactory: class {},
}));
jest.mock('src/auth/shared/guards/auth.guard', () => ({
  AuthGuard: class {},
}));

const createController = (verifyError?: Error) => {
  const verifyPaymentStatus = jest.fn(() =>
    verifyError ? Promise.reject(verifyError) : Promise.resolve({}),
  );
  const factory = {
    getMoyasarProvider: () => ({
      verifyWebhook: () => Promise.resolve('pay_1'),
    }),
  };
  const controller = new PaymentTransactionsController(
    { verifyPaymentStatus } as never,
    factory as never,
  );
  return { controller, verifyPaymentStatus };
};

const payload = { id: 'evt_1', type: 'payment_paid', data: { id: 'pay_1' } };

describe('PaymentTransactionsController.handleMoyasarWebhook', () => {
  it('acknowledges a processed payment', async () => {
    const { controller, verifyPaymentStatus } = createController();

    await expect(controller.handleMoyasarWebhook(payload)).resolves.toEqual({
      received: true,
    });
    expect(verifyPaymentStatus).toHaveBeenCalledWith('pay_1');
  });

  it.each([
    ['unknown payment (e.g. a payout event)', new NotFoundException()],
    ['invalid metadata', new BadRequestException()],
  ])('acknowledges permanent failures: %s', async (_, error) => {
    const { controller } = createController(error);

    await expect(controller.handleMoyasarWebhook(payload)).resolves.toEqual({
      received: true,
    });
  });

  it.each([
    ['provider unavailable', new ServiceUnavailableException()],
    ['database error', new Error('connection reset')],
  ])('fails transient errors so Moyasar redelivers: %s', async (_, error) => {
    const { controller } = createController(error);

    await expect(controller.handleMoyasarWebhook(payload)).rejects.toBe(error);
  });
});

describe('PaymentTransactionsController reads the caller from the JWT payload', () => {
  // AuthGuard sets request.user to the JwtPayload: the id is `user_id`, not `_id`.
  const req = { user: { user_id: 'u1', email: 'a@b.c' } } as never;

  it('links the payment for req.user.user_id', async () => {
    const linkMoyasarPayment = jest.fn(() => Promise.resolve({ linked: true }));
    const controller = new PaymentTransactionsController(
      { linkMoyasarPayment } as never,
      {} as never,
    );

    await controller.linkMoyasarPayment({ paymentId: 'pay_1' }, req);

    expect(linkMoyasarPayment).toHaveBeenCalledWith('pay_1', 'u1');
  });

  it('retries for req.user.user_id and email', async () => {
    const retryPayment = jest.fn(() => Promise.resolve({ paymentUrl: 'u' }));
    const controller = new PaymentTransactionsController(
      { retryPayment } as never,
      {} as never,
    );

    await controller.retryPayment({ orderId: 'o1' }, req);

    expect(retryPayment).toHaveBeenCalledWith('o1', 'u1', 'a@b.c');
  });
});
