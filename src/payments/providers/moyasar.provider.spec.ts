import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { MoyasarProvider } from './moyasar.provider';

// PaymentsService pulls in settings → file-upload → ESM-only `uuid`.
jest.mock('../payments.service', () => ({ PaymentsService: class {} }));

const createProvider = (get: jest.Mock) =>
  new MoyasarProvider(
    { get } as never,
    { findByCode: () => Promise.resolve(null) } as never,
  );

describe('MoyasarProvider.fetchPayment', () => {
  it('returns the payment', async () => {
    const payment = { id: 'pay_1', status: 'paid' };
    const provider = createProvider(jest.fn(() => of({ data: payment })));

    await expect(provider.fetchPayment('pay_1')).resolves.toEqual(payment);
  });

  it('returns null when Moyasar has no such payment', async () => {
    const provider = createProvider(
      jest.fn(() =>
        throwError(() => ({ message: '404', response: { status: 404 } })),
      ),
    );

    await expect(provider.fetchPayment('payout_1')).resolves.toBeNull();
  });

  it.each([
    ['a Moyasar 5xx', { message: '502', response: { status: 502 } }],
    ['rejected credentials', { message: '401', response: { status: 401 } }],
    ['a network error or timeout', { message: 'timeout of 10000ms exceeded' }],
  ])('throws 503 on %s', async (_, error) => {
    const provider = createProvider(jest.fn(() => throwError(() => error)));

    await expect(provider.fetchPayment('pay_1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
