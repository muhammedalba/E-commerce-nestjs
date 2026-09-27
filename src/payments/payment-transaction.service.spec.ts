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
  provider: string;
  amount: number;
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
    provider: 'MOYASAR',
    amount: 100,
    status: PaymentStatus.PENDING,
    providerPaymentId: 'pay_1',
    metadata: {},
    ...initial,
  };
  const model = {
    state,
    findOne: jest.fn(() =>
      Promise.resolve({ ...state, save: jest.fn(() => Promise.resolve()) }),
    ),
    findOneAndUpdate: jest.fn(
      (
        filter: { status: { $nin: PaymentStatus[] } },
        update: { $set: Record<string, unknown> },
      ) => {
        if (filter.status.$nin.includes(state.status)) {
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
      reason: 'Declined',
    });
  });

  it('marks a pending transaction FAILED on amount mismatch without emitting', async () => {
    const model = fakeTransactionModel();
    const { service, eventEmitter } = createService(model);

    await service.processMoyasarWebhook(paidPayment({ amount: 1 }));

    expect(model.state.status).toBe(PaymentStatus.FAILED);
    expect(model.state.metadata.failureReason).toBe('Amount mismatch detected');
    expect(eventEmitter.emit).not.toHaveBeenCalled();
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
