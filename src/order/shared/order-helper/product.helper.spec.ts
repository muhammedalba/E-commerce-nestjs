import { Types } from 'mongoose';
import { ProductHelperService, StockShortageError } from './product.helper';

describe('ProductHelperService – awaited aggregate sync after stock changes', () => {
  const productId = new Types.ObjectId();
  const items = [
    {
      product: { id: productId, isUnlimitedStock: false },
      variant: { id: new Types.ObjectId(), stock: 5, sold: 0 },
      quantity: 2,
    },
    // Same product twice (two variants) → one event only
    {
      product: { id: productId, isUnlimitedStock: false },
      variant: { id: new Types.ObjectId(), stock: 3, sold: 1 },
      quantity: 1,
    },
  ] as unknown as Parameters<ProductHelperService['updateProductStats']>[0];

  let emit: jest.Mock;
  let service: ProductHelperService;

  beforeEach(() => {
    emit = jest.fn().mockResolvedValue(undefined);
    service = new ProductHelperService(
      {} as never,
      { bulkWrite: jest.fn().mockResolvedValue({}) } as never,
      { syncProduct: emit } as never,
    );
  });

  // syncProduct recomputes stockSummary and only then clears the backend
  // cache + revalidates Next; awaited so responses are sent with fresh reads.
  it.each([
    'updateProductStats',
    'revertProductStats',
    'confirmReservation',
  ] as const)('%s syncs each product once (awaited)', async (method) => {
    await service[method](items);

    expect(emit).toHaveBeenCalledTimes(1);
    const [id] = emit.mock.calls[0] as [Types.ObjectId];
    expect(String(id)).toBe(String(productId));
  });

  it.each(['reserveStock', 'releaseReservation'] as const)(
    '%s does not sync (reserved is not displayed)',
    async (method) => {
      await service[method](items);
      expect(emit).not.toHaveBeenCalled();
    },
  );
});

describe('ProductHelperService.restockOrderItems', () => {
  const limitedId = new Types.ObjectId();
  const unlimitedId = new Types.ObjectId();
  const v1 = new Types.ObjectId();
  const v2 = new Types.ObjectId();
  const lines = [
    { productId: limitedId, variantId: v1, quantity: 2 },
    { productId: unlimitedId, variantId: v2, quantity: 3 },
  ];

  let bulkWrite: jest.Mock;
  let emit: jest.Mock;
  let service: ProductHelperService;

  beforeEach(() => {
    bulkWrite = jest.fn().mockResolvedValue({});
    emit = jest.fn().mockResolvedValue(undefined);
    const find = jest.fn((query: { _id?: unknown }) => ({
      select: (fields: string) => ({
        lean: () =>
          Promise.resolve(
            fields === 'isUnlimitedStock'
              ? [
                  { _id: limitedId, isUnlimitedStock: false },
                  { _id: unlimitedId, isUnlimitedStock: true },
                ]
              : query && [{ slug: 'x' }],
          ),
      }),
    }));
    service = new ProductHelperService(
      { find } as never,
      { bulkWrite } as never,
      { syncProduct: emit } as never,
    );
  });

  const ops = () =>
    (
      (bulkWrite.mock.calls as unknown[][][])[0][0] as {
        updateOne: {
          filter: unknown;
          update: [{ $set: Record<string, unknown> }];
        };
      }[]
    ).map((o) => o.updateOne);

  it('deducted: returns stock (limited only) and lowers sold, atomically', async () => {
    await service.restockOrderItems(lines, 'deducted');

    const [limited, unlimited] = ops();
    expect(limited.filter).toEqual({ _id: v1 });
    expect(limited.update[0].$set.stock).toEqual({ $add: ['$stock', 2] });
    expect(limited.update[0].$set.sold).toEqual({
      $max: [0, { $subtract: [{ $ifNull: ['$sold', 0] }, 2] }],
    });
    // Unlimited products never had stock deducted → only sold changes
    expect(unlimited.update[0].$set.stock).toBeUndefined();
    expect(unlimited.update[0].$set.sold).toBeDefined();

    // stockSummary re-sync for both products
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('reserved: only releases the reservation of limited products', async () => {
    await service.restockOrderItems(lines, 'reserved');

    const all = ops();
    expect(all).toHaveLength(1);
    expect(all[0].filter).toEqual({ _id: v1 });
    expect(all[0].update[0].$set).toEqual({
      reserved: {
        $max: [0, { $subtract: [{ $ifNull: ['$reserved', 0] }, 2] }],
      },
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it('does nothing for an empty order', async () => {
    await service.restockOrderItems([], 'deducted');
    expect(bulkWrite).not.toHaveBeenCalled();
  });
});

describe('ProductHelperService.deductOrderItems (reactivation, transactional)', () => {
  const pA = new Types.ObjectId();
  const pB = new Types.ObjectId();
  const vA = new Types.ObjectId();
  const vB = new Types.ObjectId();
  const lines = [
    { productId: pA, variantId: vA, quantity: 2 },
    { productId: pB, variantId: vB, quantity: 3 },
  ];
  const session = { id: 'tx' } as never;

  let updateOne: jest.Mock;
  let emit: jest.Mock;
  let service: ProductHelperService;

  // query chain: .select().session().lean()
  const chain = (value: unknown) => ({
    select: () => ({
      session: () => ({ lean: () => Promise.resolve(value) }),
    }),
  });

  const build = (unlimitedIds: Types.ObjectId[] = []) => {
    service = new ProductHelperService(
      {
        find: () =>
          chain(
            [pA, pB].map((id) => ({
              _id: id,
              isUnlimitedStock: unlimitedIds.includes(id),
            })),
          ),
      } as never,
      {
        updateOne,
        findById: () => chain({ sku: 'SKU-B', stock: 1, reserved: 0 }),
      } as never,
      { syncProduct: emit } as never,
    );
  };

  beforeEach(() => {
    updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    emit = jest.fn().mockResolvedValue(undefined);
  });

  it('takes stock with a conditional atomic update, inside the session', async () => {
    build();
    await service.deductOrderItems(lines, 'deducted', session);

    expect(updateOne).toHaveBeenCalledTimes(2);
    expect(updateOne).toHaveBeenCalledWith(
      {
        _id: vA,
        $expr: {
          $gte: [{ $subtract: ['$stock', { $ifNull: ['$reserved', 0] }] }, 2],
        },
      },
      { $inc: { stock: -2, sold: 2 } },
      { session },
    );
    // Side effects are the caller's job, after commit
    expect(emit).not.toHaveBeenCalled();
  });

  it('on shortage: throws StockShortageError (tx abort undoes earlier lines)', async () => {
    build();
    updateOne
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockResolvedValueOnce({ modifiedCount: 0 });

    const err = await service
      .deductOrderItems(lines, 'deducted', session)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(StockShortageError);
    expect((err as StockShortageError).shortage).toEqual({
      variantId: String(vB),
      sku: 'SKU-B',
      requested: 3,
      available: 1,
    });
  });

  it('unlimited products: no stock check, only sold += qty', async () => {
    build([pB]);
    await service.deductOrderItems(lines, 'deducted', session);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: vB },
      { $inc: { sold: 3 } },
      { session },
    );
  });

  it('reserved mode (unpaid Moyasar): re-reserves instead of deducting', async () => {
    build();
    await service.deductOrderItems(lines, 'reserved', session);
    expect(updateOne).toHaveBeenCalledWith(
      expect.anything(),
      { $inc: { reserved: 2 } },
      { session },
    );
  });
});
