import { Types } from 'mongoose';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaymentTransactionService } from './payment-transaction.service';
import { PaymentStatus } from './shared/enums/payment-status.enum';
import { WebhookMoyasarDto } from './shared/dto/webhook-moyasar.dto';

// The real factory pulls in settings → file-upload → ESM-only `uuid`, which
// Jest cannot load; these tests never reach the provider.
jest.mock('./providers/payment-provider.factory', () => ({
  PaymentProviderFactory: class {},
}));

/** Same options as the global pipe in main.ts. */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

type TxState = {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  userId: Types.ObjectId;
  provider: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  providerPaymentId?: string;
  metadata: Record<string, unknown>;
};

/**
 * In-memory stand-in for the transaction model holding one transaction.
 * `findOne` hands out a snapshot, like a document loaded by a separate request;
 * `findOneAndUpdate` evaluates its status filter atomically, like MongoDB.
 */
const fakeTransactionModel = (initial: Partial<TxState> = {}) => {
  const state: TxState = {
    _id: new Types.ObjectId(),
    orderId: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    provider: 'MOYASAR',
    amount: 100,
    currency: 'SAR',
    status: PaymentStatus.PENDING,
    providerPaymentId: 'pay_1',
    metadata: {},
    ...initial,
  };
  /** Snapshot whose save() persists the only field the service links: providerPaymentId. */
  const snapshot = () => {
    const doc = {
      ...state,
      save: jest.fn(() => {
        state.providerPaymentId = doc.providerPaymentId;
        return Promise.resolve();
      }),
    };
    return doc;
  };
  const matches = (filter: {
    providerPaymentId?: string | null;
    status?: { $in: PaymentStatus[] };
  }) =>
    (!('providerPaymentId' in filter) ||
      (state.providerPaymentId ?? null) === filter.providerPaymentId) &&
    (!filter.status || filter.status.$in.includes(state.status));
  /** Chainable like a Mongoose query: awaitable, with .sort(). */
  const query = <T>(value: T) =>
    Object.assign(Promise.resolve(value), {
      sort: () => Promise.resolve(value),
    });
  const model = {
    state,
    findOne: jest.fn((filter: Parameters<typeof matches>[0]) =>
      query(matches(filter) ? snapshot() : null),
    ),
    findById: jest.fn(() => Promise.resolve(snapshot())),
    findOneAndUpdate: jest.fn(
      (
        filter: { status: { $nin?: PaymentStatus[]; $in?: PaymentStatus[] } },
        update: { $set: Record<string, unknown> },
      ) => {
        const { $nin, $in } = filter.status;
        if (
          $nin?.includes(state.status) ||
          ($in && !$in.includes(state.status))
        ) {
          return Promise.resolve(null);
        }
        for (const [key, value] of Object.entries(update.$set)) {
          if (key.startsWith('metadata.')) {
            state.metadata[key.slice('metadata.'.length)] = value;
          } else {
            (state as Record<string, unknown>)[key] = value;
          }
        }
        return Promise.resolve({ ...state });
      },
    ),
  };
  return model;
};

const createService = (model: ReturnType<typeof fakeTransactionModel>) => {
  const eventEmitter = { emit: jest.fn() };
  const service = new PaymentTransactionService(
    model as never,
    {} as never,
    {} as never,
    eventEmitter as never,
  );
  return { service, eventEmitter };
};

const paidPayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'pay_1',
  status: 'paid',
  amount: 10000,
  currency: 'SAR',
  metadata: { orderId: new Types.ObjectId().toString() },
  ...overrides,
});

describe('WebhookMoyasarDto', () => {
  it('accepts the envelope Moyasar actually sends', async () => {
    const body = {
      id: 'evt_1',
      type: 'payment_paid',
      created_at: '2026-09-27T13:00:00Z',
      secret_token: 'token',
      account_name: null,
      live: false,
      data: { id: 'pay_1' },
    };
    const errors = await validate(
      plainToInstance(WebhookMoyasarDto, body),
      PIPE_OPTIONS,
    );
    expect(errors).toEqual([]);
  });

  it('still rejects undeclared top-level fields', async () => {
    const body = { id: 'evt_1', type: 'payment_paid', data: {}, extra: 1 };
    const errors = await validate(
      plainToInstance(WebhookMoyasarDto, body),
      PIPE_OPTIONS,
    );
    expect(errors.map((e) => e.property)).toEqual(['extra']);
  });
});

describe('PaymentTransactionService.processMoyasarWebhook', () => {
  it('emits payment.succeeded once when webhook and verify process the same payment concurrently', async () => {
    const model = fakeTransactionModel();
    const { service, eventEmitter } = createService(model);

    await Promise.all([
      service.processMoyasarWebhook(paidPayment()),
      service.processMoyasarWebhook(paidPayment()),
    ]);

    expect(model.state.status).toBe(PaymentStatus.PAID);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.succeeded',
      expect.objectContaining({
        orderId: model.state.orderId.toString(),
        userId: model.state.userId.toString(),
        transactionId: model.state._id.toString(),
        amount: 100,
      }),
    );
  });

  it('marks the transaction FAILED and emits payment.failed once', async () => {
    const model = fakeTransactionModel();
    const { service, eventEmitter } = createService(model);
    const failed = paidPayment({ status: 'failed', message: 'Declined' });

    await service.processMoyasarWebhook(failed);
    await service.processMoyasarWebhook(failed);

    expect(model.state.status).toBe(PaymentStatus.FAILED);
    expect(model.state.metadata.failureReason).toBe('Declined');
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith('payment.failed', {
      orderId: model.state.orderId.toString(),
      userId: model.state.userId.toString(),
      reason: 'Declined',
    });
  });

  it('records the issuer message, code and category from the payment source', async () => {
    const model = fakeTransactionModel();
    const { service, eventEmitter } = createService(model);

    await service.processMoyasarWebhook(
      paidPayment({
        status: 'failed',
        source: {
          type: 'creditcard',
          message: 'INSUFFICIENT FUNDS',
          response_code: '51',
        },
      }),
    );

    expect(model.state.metadata).toMatchObject({
      failureReason: 'INSUFFICIENT FUNDS',
      failureCode: '51',
      failureCategory: 'insufficient_funds',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.failed',
      expect.objectContaining({ reason: 'INSUFFICIENT FUNDS' }),
    );
  });

  it('fails the transaction on amount mismatch and emits payment.failed once, so the order is cancelled', async () => {
    const model = fakeTransactionModel();
    const { service, eventEmitter } = createService(model);

    await service.processMoyasarWebhook(paidPayment({ amount: 1 }));
    await service.processMoyasarWebhook(paidPayment({ amount: 1 }));

    expect(model.state.status).toBe(PaymentStatus.FAILED);
    expect(model.state.metadata.failureReason).toBe('Amount mismatch detected');
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith('payment.failed', {
      orderId: model.state.orderId.toString(),
      userId: model.state.userId.toString(),
      reason: 'Amount mismatch detected',
    });
  });

  it('never overwrites a PAID transaction', async () => {
    const model = fakeTransactionModel({ status: PaymentStatus.PAID });
    const { service, eventEmitter } = createService(model);

    await service.processMoyasarWebhook(paidPayment());
    await service.processMoyasarWebhook(paidPayment({ amount: 1 }));

    expect(model.state.status).toBe(PaymentStatus.PAID);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});

describe('PaymentTransactionService currency check', () => {
  it('fails a payment made in another currency and emits payment.failed', async () => {
    const model = fakeTransactionModel();
    const { service, eventEmitter } = createService(model);

    await service.processMoyasarWebhook(paidPayment({ currency: 'USD' }));

    expect(model.state.status).toBe(PaymentStatus.FAILED);
    expect(model.state.metadata.failureReason).toBe(
      'Currency mismatch detected',
    );
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.failed',
      expect.objectContaining({ reason: 'Currency mismatch detected' }),
    );
  });

  it('matches a store currency stored as the Arabic symbol, like the checkout page', async () => {
    const model = fakeTransactionModel({ currency: 'ر.س' });
    const { service, eventEmitter } = createService(model);

    await service.processMoyasarWebhook(paidPayment({ currency: 'SAR' }));

    expect(model.state.status).toBe(PaymentStatus.PAID);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });
});

describe('PaymentTransactionService.verifyPaymentStatus', () => {
  it('rejects invalid orderId metadata with a 400 instead of a cast error', async () => {
    const fetchPayment = jest.fn(() =>
      Promise.resolve(paidPayment({ metadata: { orderId: 'not-an-id' } })),
    );
    const service = new PaymentTransactionService(
      fakeTransactionModel() as never,
      {} as never,
      { getMoyasarProvider: () => ({ fetchPayment }) } as never,
      { emit: jest.fn() } as never,
    );

    await expect(service.verifyPaymentStatus('pay_1')).rejects.toMatchObject({
      status: 400,
      message: 'Payment orderId metadata is invalid',
    });
  });
});

describe('PaymentTransactionService late payments', () => {
  const lateSetup = (status: PaymentStatus) => {
    const model = fakeTransactionModel({
      status,
      providerPaymentId: undefined,
    });
    const eventEmitter = { emit: jest.fn() };
    const payment = paidPayment({
      metadata: { orderId: model.state.orderId.toString() },
    });
    const service = new PaymentTransactionService(
      model as never,
      { findById: () => Promise.resolve({ status: 'expired' }) } as never,
      {
        getMoyasarProvider: () => ({
          fetchPayment: () => Promise.resolve(payment),
        }),
      } as never,
      eventEmitter as never,
    );
    return { model, eventEmitter, service, payment };
  };

  it.each([PaymentStatus.EXPIRED, PaymentStatus.CANCELLED])(
    'records a capture that arrives after the transaction was %s',
    async (status) => {
      const { model, eventEmitter, service } = lateSetup(status);

      const result = await service.verifyPaymentStatus('pay_1');

      expect(model.state.status).toBe(PaymentStatus.PAID);
      expect(model.state.providerPaymentId).toBe('pay_1');
      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
      // The order handler flags the order for manual refund/review.
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'payment.succeeded',
        expect.objectContaining({ orderId: model.state.orderId.toString() }),
      );
    },
  );

  it('does not touch an expired transaction for a failed payment', async () => {
    const { model, eventEmitter, service, payment } = lateSetup(
      PaymentStatus.EXPIRED,
    );
    payment.status = 'failed';

    await service.verifyPaymentStatus('pay_1');

    expect(model.state.status).toBe(PaymentStatus.EXPIRED);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('does not relink an expired transaction already tied to another payment', async () => {
    const model = fakeTransactionModel({
      status: PaymentStatus.EXPIRED,
      providerPaymentId: 'pay_other',
    });
    const { service, eventEmitter } = createService(model);

    await service.processMoyasarWebhook(
      paidPayment({ metadata: { orderId: model.state.orderId.toString() } }),
    );

    expect(model.state.status).toBe(PaymentStatus.EXPIRED);
    expect(model.state.providerPaymentId).toBe('pay_other');
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});

describe('PaymentTransactionService.linkMoyasarPayment', () => {
  const linkSetup = (
    opts: { status?: PaymentStatus; ownsOrder?: boolean } = {},
  ) => {
    const model = fakeTransactionModel({
      status: opts.status ?? PaymentStatus.PENDING,
      providerPaymentId: undefined,
    });
    const exists = jest.fn(() =>
      Promise.resolve(opts.ownsOrder === false ? null : { _id: 'o' }),
    );
    const payment = paidPayment({
      id: 'pay_new',
      status: 'initiated',
      metadata: { orderId: model.state.orderId.toString() },
    });
    const service = new PaymentTransactionService(
      model as never,
      { exists } as never,
      {
        getMoyasarProvider: () => ({
          fetchPayment: () => Promise.resolve(payment),
        }),
      } as never,
      { emit: jest.fn() } as never,
    );
    return { model, exists, service };
  };

  it("links the payment to the caller's open transaction, using the order Moyasar reports", async () => {
    const { model, exists, service } = linkSetup();

    await expect(
      service.linkMoyasarPayment('pay_new', 'user1'),
    ).resolves.toEqual({ linked: true });

    expect(exists).toHaveBeenCalledWith({
      _id: model.state.orderId.toString(),
      user: 'user1',
    });
    expect(model.state.providerPaymentId).toBe('pay_new');
    expect(model.state.status).toBe(PaymentStatus.PENDING);
  });

  it("refuses to link a payment for someone else's order", async () => {
    const { model, service } = linkSetup({ ownsOrder: false });

    await expect(
      service.linkMoyasarPayment('pay_new', 'attacker'),
    ).rejects.toMatchObject({ status: 404 });
    expect(model.state.providerPaymentId).toBeUndefined();
  });

  it('does not link a transaction that is no longer open', async () => {
    const { model, service } = linkSetup({ status: PaymentStatus.EXPIRED });

    await expect(
      service.linkMoyasarPayment('pay_new', 'user1'),
    ).resolves.toEqual({ linked: false });
    expect(model.state.providerPaymentId).toBeUndefined();
  });
});

describe('PaymentTransactionService minor units', () => {
  it('accepts a 3-decimal currency paid in fils (×1000, not ×100)', async () => {
    const model = fakeTransactionModel({ amount: 12.345, currency: 'KWD' });
    const { service } = createService(model);

    await service.processMoyasarWebhook(
      paidPayment({ amount: 12345, currency: 'KWD' }),
    );

    expect(model.state.status).toBe(PaymentStatus.PAID);
  });
});

describe('PaymentTransactionService.retryPayment', () => {
  it('cancels the other open transactions only after creating the new one, keeping the newest', async () => {
    const calls: string[] = [];
    const newestQuery = {
      sort: () => newestQuery,
      select: () => newestQuery,
      lean: () => Promise.resolve({ _id: 'tx_new' }),
    };
    const updateMany = jest.fn(() => {
      calls.push('cancel');
      return Promise.resolve();
    });
    const service = new PaymentTransactionService(
      { findOne: jest.fn(() => newestQuery), updateMany } as never,
      {
        findOne: () =>
          Promise.resolve({
            status: 'pending_payment',
            paymentStatus: 'PENDING',
            paymentMethodCode: 'moyasar',
            grandTotal: 100,
            currency: 'SAR',
          }),
      } as never,
      {} as never,
      { emit: jest.fn() } as never,
    );
    jest.spyOn(service, 'initiatePayment').mockImplementation(() => {
      calls.push('create');
      return Promise.resolve({
        paymentUrl: 'https://pay',
        transactionId: 'tx_new',
      });
    });
    const orderId = new Types.ObjectId().toString();

    await expect(service.retryPayment(orderId, 'u1', 'a@b.c')).resolves.toEqual(
      {
        paymentUrl: 'https://pay',
      },
    );

    expect(calls).toEqual(['create', 'cancel']);
    expect(updateMany).toHaveBeenCalledWith(
      {
        orderId,
        status: { $in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
        _id: { $ne: 'tx_new' },
      },
      { $set: { status: PaymentStatus.CANCELLED } },
    );
  });
});

describe('PaymentTransactionService.processMoyasarRefund', () => {
  /** Paid transaction; the conditional update mimics the status + "higher total" filter. */
  const refundModel = (initial: Record<string, unknown> = {}) => {
    const state: Record<string, unknown> = {
      _id: new Types.ObjectId(),
      orderId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      currency: 'SAR',
      status: PaymentStatus.PAID,
      providerPaymentId: 'pay_1',
      refundedAmount: undefined,
      ...initial,
    };
    return {
      state,
      findOne: jest.fn((filter: { providerPaymentId: string }) =>
        Promise.resolve(
          filter.providerPaymentId === state.providerPaymentId
            ? { ...state }
            : null,
        ),
      ),
      findOneAndUpdate: jest.fn(
        (
          filter: { status: { $in: PaymentStatus[] } },
          update: { $set: { refundedAmount: number } },
        ) => {
          const current = state.refundedAmount as number | undefined;
          if (
            !filter.status.$in.includes(state.status as PaymentStatus) ||
            (current != null && current >= update.$set.refundedAmount)
          ) {
            return Promise.resolve(null);
          }
          Object.assign(state, update.$set);
          return Promise.resolve({ ...state });
        },
      ),
    };
  };
  const setup = (initial?: Record<string, unknown>) => {
    const model = refundModel(initial);
    const eventEmitter = { emit: jest.fn() };
    const service = new PaymentTransactionService(
      model as never,
      {} as never,
      {} as never,
      eventEmitter as never,
    );
    return { model, eventEmitter, service };
  };
  const refunded = (refundedMinor: number, status = 'refunded') => ({
    id: 'pay_1',
    status,
    amount: 10000,
    refunded: refundedMinor,
  });

  it('records a full refund once, even when webhook and polling race', async () => {
    const { model, eventEmitter, service } = setup();

    await Promise.all([
      service.processMoyasarRefund(refunded(10000)),
      service.processMoyasarRefund(refunded(10000)),
    ]);

    expect(model.state.status).toBe(PaymentStatus.REFUNDED);
    expect(model.state.refundedAmount).toBe(100);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.refunded',
      expect.objectContaining({
        refundedAmount: 100,
        currency: 'SAR',
        isFull: true,
      }),
    );
  });

  it('records partial refunds as the cumulative total rises, ignoring redeliveries', async () => {
    const { model, eventEmitter, service } = setup();

    await service.processMoyasarRefund(refunded(2500));
    await service.processMoyasarRefund(refunded(2500)); // redelivery
    await service.processMoyasarRefund(refunded(6000)); // second refund, total 60

    expect(model.state.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    expect(model.state.refundedAmount).toBe(60);
    expect(
      eventEmitter.emit.mock.calls.map(
        ([, p]) => p as { refundedAmount: number; isFull: boolean },
      ),
    ).toEqual([
      expect.objectContaining({ refundedAmount: 25, isFull: false }),
      expect.objectContaining({ refundedAmount: 60, isFull: false }),
    ]);
  });

  it('treats a void as a full refund', async () => {
    const { model, eventEmitter, service } = setup();

    await service.processMoyasarRefund(refunded(0, 'voided'));

    expect(model.state.status).toBe(PaymentStatus.REFUNDED);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.refunded',
      expect.objectContaining({ refundedAmount: 100, isFull: true }),
    );
  });

  it('ignores a refund for a transaction that was never paid', async () => {
    const { model, eventEmitter, service } = setup({
      status: PaymentStatus.PENDING,
    });

    await service.processMoyasarRefund(refunded(10000));

    expect(model.state.status).toBe(PaymentStatus.PENDING);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('is reached from verifyPaymentStatus, which the refund webhooks go through', async () => {
    const orderId = new Types.ObjectId();
    const txQuery = {
      sort: () =>
        Promise.resolve({ _id: 't1', orderId, status: PaymentStatus.PAID }),
    };
    const service = new PaymentTransactionService(
      {
        findOne: () => txQuery,
        findById: () =>
          Promise.resolve({
            _id: 't1',
            orderId,
            status: PaymentStatus.REFUNDED,
            amount: 100,
            currency: 'SAR',
          }),
      } as never,
      { findById: () => Promise.resolve({ status: 'cancelled' }) } as never,
      {
        getMoyasarProvider: () => ({
          fetchPayment: () =>
            Promise.resolve({
              ...refunded(10000),
              metadata: { orderId: orderId.toString() },
            }),
        }),
      } as never,
      { emit: jest.fn() } as never,
    );
    const processRefund = jest
      .spyOn(service, 'processMoyasarRefund')
      .mockResolvedValue();

    const result = await service.verifyPaymentStatus('pay_1');

    expect(processRefund).toHaveBeenCalledTimes(1);
    expect(result.paymentStatus).toBe(PaymentStatus.REFUNDED);
  });
});
