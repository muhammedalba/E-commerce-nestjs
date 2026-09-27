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
