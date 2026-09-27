import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentSchedulerService } from './payment-scheduler.service';
import { PaymentStatus } from './shared/enums/payment-status.enum';

/** In-memory stand-in for the two model calls the scheduler makes. */
const fakeTransactionModel = (
  docs: { _id: string; orderId: string; status: PaymentStatus }[],
) => ({
  find: jest.fn(() => {
    // Snapshot at scan time, like a real query
    const ids = docs
      .filter((d) =>
        [PaymentStatus.INITIATED, PaymentStatus.PENDING].includes(d.status),
      )
      .map(({ _id }) => ({ _id }));
    return { select: () => ({ lean: () => Promise.resolve(ids) }) };
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

describe('PaymentSchedulerService', () => {
  it('emits payment.expired once per transaction even when two instances run together', async () => {
    const docs = [
      { _id: 't1', orderId: 'o1', status: PaymentStatus.PENDING },
      { _id: 't2', orderId: 'o2', status: PaymentStatus.INITIATED },
    ];
    const model = fakeTransactionModel(docs);
    const emitter = { emit: jest.fn() } as unknown as EventEmitter2;
    const a = new PaymentSchedulerService(model as never, emitter);
    const b = new PaymentSchedulerService(model as never, emitter);

    await Promise.all([a.checkExpiredPayments(), b.checkExpiredPayments()]);

    const expired = (emitter.emit as jest.Mock).mock.calls.filter(
      ([event]) => event === 'payment.expired',
    );
    expect(
      expired.map(([, p]) => (p as { orderId: string }).orderId).sort(),
    ).toEqual(['o1', 'o2']);
    expect(docs.every((d) => d.status === PaymentStatus.EXPIRED)).toBe(true);
  });

  it('does not expire a transaction paid between the scan and the update', async () => {
    const docs = [{ _id: 't1', orderId: 'o1', status: PaymentStatus.PENDING }];
    const model = fakeTransactionModel(docs);
    const find = model.find;
    model.find = jest.fn(() => {
      const result = find();
      docs[0].status = PaymentStatus.PAID; // webhook lands right after the scan
      return result;
    });
    const emit = jest.fn();

    await new PaymentSchedulerService(
      model as never,
      {
        emit,
      } as unknown as EventEmitter2,
    ).checkExpiredPayments();

    expect(emit).not.toHaveBeenCalled();
    expect(docs[0].status).toBe(PaymentStatus.PAID);
  });
});
