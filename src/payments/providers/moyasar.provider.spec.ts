import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { MoyasarProvider } from './moyasar.provider';

// PaymentsService pulls in settings → file-upload → ESM-only `uuid`.
jest.mock('../payments.service', () => ({ PaymentsService: class {} }));

const createProvider = (get: jest.Mock) =>
  new MoyasarProvider(
    { get } as never,
    { findCredentialsByCode: () => Promise.resolve(null) } as never,
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

describe('MoyasarProvider credentials', () => {
  it('encodes the payment id so it cannot change the API path', async () => {
    const get = jest.fn(() => of({ data: {} }));
    await createProvider(get).fetchPayment('../invoices/x');

    expect(get).toHaveBeenCalledWith(
      'https://api.moyasar.com/v1/payments/..%2Finvoices%2Fx',
      expect.anything(),
    );
  });

  it('uses the stored key even while payments or the method are disabled', async () => {
    const findCredentialsByCode = jest.fn(() =>
      Promise.resolve({ secretConfig: { MOYASAR_SECRET_KEY: 'sk_db' } }),
    );
    const get = jest.fn(() => of({ data: {} }));
    const provider = new MoyasarProvider(
      { get } as never,
      { findCredentialsByCode } as never,
    );

    await provider.fetchPayment('pay_1');

    expect(findCredentialsByCode).toHaveBeenCalledWith('moyasar');
    expect(get).toHaveBeenCalledWith(expect.any(String), {
      headers: {
        Authorization: `Basic ${Buffer.from('sk_db:').toString('base64')}`,
      },
    });
  });
});

describe('MoyasarProvider.verifyWebhook', () => {
  const payload = (secret_token?: string) => ({
    id: 'evt_1',
    type: 'payment_paid',
    data: { id: 'pay_1' },
    secret_token,
  });
  const providerWithSecret = (secret?: string) =>
    new MoyasarProvider(
      {} as never,
      {
        findCredentialsByCode: () =>
          Promise.resolve(
            secret
              ? { secretConfig: { MOYASAR_WEBHOOK_SECRET: secret } }
              : null,
          ),
      } as never,
    );
  const savedEnvSecret = process.env.MOYASAR_WEBHOOK_SECRET;
  beforeEach(() => delete process.env.MOYASAR_WEBHOOK_SECRET);
  afterAll(() => {
    if (savedEnvSecret !== undefined) {
      process.env.MOYASAR_WEBHOOK_SECRET = savedEnvSecret;
    }
  });

  it('returns the payment id when the token matches', async () => {
    await expect(
      providerWithSecret('whsec_1').verifyWebhook(payload('whsec_1')),
    ).resolves.toBe('pay_1');
  });

  it.each([
    ['a wrong token', 'whsec_2'],
    ['a token of another length', 'whsec_1_longer'],
    ['no token', undefined],
  ])('rejects %s', async (_, token) => {
    await expect(
      providerWithSecret('whsec_1').verifyWebhook(payload(token)),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects every webhook when no secret is configured (was: accepted all)', async () => {
    await expect(
      providerWithSecret(undefined).verifyWebhook(payload('anything')),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      providerWithSecret(undefined).verifyWebhook(payload(undefined)),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('falls back to the env secret when none is stored', async () => {
    process.env.MOYASAR_WEBHOOK_SECRET = 'whsec_env';

    await expect(
      providerWithSecret(undefined).verifyWebhook(payload('whsec_env')),
    ).resolves.toBe('pay_1');
  });
});
