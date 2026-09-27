import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceUnavailableException } from '@nestjs/common';
import { PaymentSchedulerService } from './payment-scheduler.service';
import { PaymentStatus } from './shared/enums/payment-status.enum';

// The real imports reach ESM-only `uuid` via settings → file-upload.
jest.mock('./providers/payment-provider.factory', () => ({
  PaymentProviderFactory: class {},
}));
jest.mock('./payment-transaction.service', () => ({
  PaymentTransactionService: class {},
}));

type Doc = {
  _id: string;
  orderId: string;
  status: PaymentStatus;
  providerPaymentId?: string;
  createdAt?: Date;
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

/** In-memory stand-in for the two model calls the scheduler makes. */
const fakeTransactionModel = (docs: Doc[]) => ({
  find: jest.fn(() => {
    // Snapshot at scan time, like a real query
    const rows = docs
      .filter((d) =>
        [PaymentStatus.INITIATED, PaymentStatus.PENDING].includes(d.status),
      )
      .map(({ _id, providerPaymentId, createdAt = minutesAgo(20) }) => ({
        _id,
        providerPaymentId,
        createdAt,
      }));
    return { select: () => ({ lean: () => Promise.resolve(rows) }) };
  }),
  findOneAndUpdate: jest.fn(
    (
      filter: { _id: string; status: { $in: PaymentStatus[] } },
      update: { $set: { status: PaymentStatus } },
    ) => {
      const doc = docs.find(
        (d) => d._id === filter._id && filter.status.$in.includes(d.status),
      );
      if (!doc) return Promise.resolve(null);
      doc.status = update.$set.status;
      return Promise.resolve({ ...doc, id: doc._id });
    },
  ),
});

/**
 * @param fetchPayment Moyasar lookup for linked transactions.
 * @param docs Settling a paid/failed payment moves the doc with that providerPaymentId.
 */
const createScheduler = (
  model: ReturnType<typeof fakeTransactionModel>,
  emitter: EventEmitter2,
  docs: Doc[] = [],
  fetchPayment: jest.Mock = jest.fn(),
) => {
  const processMoyasarWebhook = jest.fn(
    (payment: { id: string; status: string }) => {
      const doc = docs.find((d) => d.providerPaymentId === payment.id);
      if (doc) {
        doc.status =
          payment.status === 'paid' ? PaymentStatus.PAID : PaymentStatus.FAILED;
      }
      return Promise.resolve();
    },
  );
  const scheduler = new PaymentSchedulerService(
    model as never,
    emitter,
    { getMoyasarProvider: () => ({ fetchPayment }) } as never,
    { processMoyasarWebhook } as never,
  );
  return { scheduler, processMoyasarWebhook };
};

const expiredOrderIds = (emit: jest.Mock) =>
  emit.mock.calls
    .filter(([event]) => event === 'payment.expired')
    .map(([, p]) => (p as { orderId: string }).orderId);

describe('PaymentSchedulerService', () => {
  it('emits payment.expired once per transaction even when two instances run together', async () => {
    const docs: Doc[] = [
      { _id: 't1', orderId: 'o1', status: PaymentStatus.PENDING },
      { _id: 't2', orderId: 'o2', status: PaymentStatus.INITIATED },
    ];
    const model = fakeTransactionModel(docs);
    const emit = jest.fn();
    const emitter = { emit } as unknown as EventEmitter2;
    const a = createScheduler(model, emitter).scheduler;
    const b = createScheduler(model, emitter).scheduler;

    await Promise.all([a.checkExpiredPayments(), b.checkExpiredPayments()]);

    expect(expiredOrderIds(emit).sort()).toEqual(['o1', 'o2']);
    expect(docs.every((d) => d.status === PaymentStatus.EXPIRED)).toBe(true);
  });

  it('does not expire a transaction paid between the scan and the update', async () => {
    const docs: Doc[] = [
      { _id: 't1', orderId: 'o1', status: PaymentStatus.PENDING },
    ];
    const model = fakeTransactionModel(docs);
    const find = model.find;
    model.find = jest.fn(() => {
      const result = find();
      docs[0].status = PaymentStatus.PAID; // webhook lands right after the scan
      return result;
    });
    const emit = jest.fn();

    await createScheduler(model, {
      emit,
    } as unknown as EventEmitter2).scheduler.checkExpiredPayments();

    expect(emit).not.toHaveBeenCalled();
    expect(docs[0].status).toBe(PaymentStatus.PAID);
  });

  it('settles a linked payment Moyasar reports as paid instead of expiring it', async () => {
    const docs: Doc[] = [
      {
        _id: 't1',
        orderId: 'o1',
        status: PaymentStatus.PENDING,
        providerPaymentId: 'pay_1',
      },
    ];
    const emit = jest.fn();
    const fetchPayment = jest.fn(() =>
      Promise.resolve({ id: 'pay_1', status: 'paid' }),
    );
    const { scheduler, processMoyasarWebhook } = createScheduler(
      fakeTransactionModel(docs),
      { emit } as unknown as EventEmitter2,
      docs,
      fetchPayment,
    );

    await scheduler.checkExpiredPayments();

    expect(fetchPayment).toHaveBeenCalledWith('pay_1');
    expect(processMoyasarWebhook).toHaveBeenCalledTimes(1);
    expect(docs[0].status).toBe(PaymentStatus.PAID);
    expect(expiredOrderIds(emit)).toEqual([]);
  });

  it.each([
    [
      'still initiated (abandoned at 3DS)',
      { id: 'pay_1', status: 'initiated' },
    ],
    ['unknown to Moyasar', null],
  ])('expires a linked payment that is %s', async (_, payment) => {
    const docs: Doc[] = [
      {
        _id: 't1',
        orderId: 'o1',
        status: PaymentStatus.PENDING,
        providerPaymentId: 'pay_1',
      },
    ];
    const emit = jest.fn();
    const { scheduler, processMoyasarWebhook } = createScheduler(
      fakeTransactionModel(docs),
      { emit } as unknown as EventEmitter2,
      docs,
      jest.fn(() => Promise.resolve(payment)),
    );

    await scheduler.checkExpiredPayments();

    expect(processMoyasarWebhook).not.toHaveBeenCalled();
    expect(expiredOrderIds(emit)).toEqual(['o1']);
  });

  it('keeps a linked payment open while Moyasar is unreachable, up to the wait limit', async () => {
    const docs: Doc[] = [
      {
        _id: 'recent',
        orderId: 'o1',
        status: PaymentStatus.PENDING,
        providerPaymentId: 'pay_1',
        createdAt: minutesAgo(20),
      },
      {
        _id: 'stale',
        orderId: 'o2',
        status: PaymentStatus.PENDING,
        providerPaymentId: 'pay_2',
        createdAt: minutesAgo(61),
      },
    ];
    const emit = jest.fn();
    const { scheduler } = createScheduler(
      fakeTransactionModel(docs),
      { emit } as unknown as EventEmitter2,
      docs,
      jest.fn(() => Promise.reject(new ServiceUnavailableException())),
    );

    await scheduler.checkExpiredPayments();

    expect(docs[0].status).toBe(PaymentStatus.PENDING);
    expect(expiredOrderIds(emit)).toEqual(['o2']);
  });
});
