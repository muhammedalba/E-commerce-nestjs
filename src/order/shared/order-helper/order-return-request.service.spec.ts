import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrderReturnRequestService } from './order-return-request.service';

jest.mock('src/invoice/credit-note.service', () => ({
  CreditNoteService: class {},
}));
jest.mock('./order-credit-note.service', () => ({
  OrderCreditNoteService: class {},
}));
jest.mock('./order-email.service', () => ({ OrderEmailService: class {} }));
jest.mock('src/settings/settings.service', () => ({
  SettingsService: class {},
}));

const DAY = 24 * 60 * 60 * 1000;
const userId = new Types.ObjectId().toString();
const orderId = new Types.ObjectId().toString();
const requestId = new Types.ObjectId().toString();
const admin = { id: new Types.ObjectId().toString(), email: 'admin@x' };

const query = <T>(value: T) => {
  const q = {
    select: () => q,
    sort: () => q,
    populate: () => q,
    lean: () => Promise.resolve(value),
  };
  return q;
};

/** A delivered order of the customer's, 3 days ago. */
const deliveredOrder = {
  _id: new Types.ObjectId(orderId),
  status: 'delivered',
  deliveredAt: new Date(Date.now() - 3 * DAY),
  invoiceNumber: 42,
};

function setup({
  order = deliveredOrder,
  windowDays = 15,
  remaining = [2, 1],
}: {
  order?: Record<string, unknown> | null;
  windowDays?: number;
  remaining?: number[];
} = {}) {
  const pending = {
    _id: new Types.ObjectId(requestId),
    order: new Types.ObjectId(orderId),
    user: new Types.ObjectId(userId),
    lines: [{ itemIndex: 0, quantity: 1 }],
    reasonType: 'defect',
    note: 'The can arrived dented',
    status: 'pending',
  };
  const ReturnRequestModel = {
    create: jest.fn((doc: Record<string, unknown>) =>
      Promise.resolve({ _id: new Types.ObjectId(requestId), ...doc }),
    ),
    findOneAndUpdate: jest.fn(() => query(pending as unknown)),
    updateOne: jest.fn(() => Promise.resolve()),
    exists: jest.fn(() => Promise.resolve(null)),
    find: jest.fn(() => query([])),
  };
  const OrderModel = {
    findOne: jest.fn(() => query(order)),
    findById: jest.fn(() => query({ invoiceNumber: 42 })),
  };
  const UserModel = {
    findById: jest.fn(() => query({ email: 'a@b.c', name: 'Ali' })),
  };
  const roleId = new Types.ObjectId();
  const RoleModel = { find: jest.fn(() => query([{ _id: roleId }])) };
  const creditNoteService = {
    summary: jest.fn(() =>
      Promise.resolve({ invoiceIssued: true, remaining, uncreditedRefund: 0 }),
    ),
  };
  const note = {
    _id: new Types.ObjectId(),
    displayNumber: 'RUH-R-8-2026-0001',
  };
  const orderCreditNoteService = {
    createFromAdmin: jest.fn(() => Promise.resolve(note)),
    preview: jest.fn(() =>
      Promise.resolve({
        amounts: { total: 345 },
        deductions: {},
        refundAmount: 345,
        includesCharges: false,
      }),
    ),
  };
  const orderEmailService = {
    sendReturnRejectedEmail: jest.fn(() => Promise.resolve()),
  };
  const eventEmitter = { emit: jest.fn() };
  const settingsService = {
    getSettings: jest.fn(() =>
      Promise.resolve({ returnWindowDays: windowDays }),
    ),
  };
  const service = new OrderReturnRequestService(
    ReturnRequestModel as never,
    OrderModel as never,
    UserModel as never,
    RoleModel as never,
    creditNoteService as never,
    orderCreditNoteService as never,
    orderEmailService as never,
    settingsService as never,
    eventEmitter as never,
  );
  return {
    service,
    settingsService,
    ReturnRequestModel,
    orderCreditNoteService,
    orderEmailService,
    eventEmitter,
    roleId,
    pending,
    note,
  };
}

const request = {
  lines: [{ itemIndex: 0, quantity: 1 }],
  reasonType: 'other' as const,
  note: 'Changed my mind',
};

describe('OrderReturnRequestService.policyFor', () => {
  const { service } = setup();
  const delivered = (daysAgo: number) => ({
    status: 'delivered',
    deliveredAt: new Date(Date.now() - daysAgo * DAY),
  });

  it('is open from delivery for the window in the settings', async () => {
    expect(await service.windowDays()).toBe(15);
    expect(service.policyFor(delivered(3), 15)).toMatchObject({
      windowDays: 15,
      open: true,
    });
    expect(service.policyFor(delivered(16), 15).open).toBe(false);
  });

  it('falls back to 5 days before the setting is saved', async () => {
    const ctx = setup();
    ctx.settingsService.getSettings.mockResolvedValueOnce({} as never);
    expect(await ctx.service.windowDays()).toBe(5);
  });

  it('is closed before delivery', () => {
    expect(
      service.policyFor({ status: 'shipped', deliveredAt: null }, 15),
    ).toMatchObject({ endsAt: null, open: false });
  });

  it('counts from completion when delivery was never recorded', () => {
    const policy = service.policyFor(
      { status: 'completed', completedAt: new Date(Date.now() - 2 * DAY) },
      15,
    );
    expect(policy.open).toBe(true);
  });

  it('is closed when the window is 0 days', () => {
    expect(service.policyFor(delivered(0), 0).open).toBe(false);
  });
});

describe('OrderReturnRequestService.create', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('saves the request and notifies the roles that can refund', async () => {
    const ctx = setup();
    await ctx.service.create(userId, orderId, request);

    expect(ctx.ReturnRequestModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonType: 'other',
        note: 'Changed my mind',
        lines: [{ itemIndex: 0, quantity: 1 }],
      }),
    );
    expect(ctx.eventEmitter.emit).toHaveBeenCalledWith(
      `role.notification.${ctx.roleId.toString()}`,
      expect.objectContaining({ action: 'return_requested' }),
    );
  });

  it('refuses before delivery and after the window', async () => {
    const shipped = setup({
      order: { _id: new Types.ObjectId(orderId), status: 'shipped' },
    });
    await expect(
      shipped.service.create(userId, orderId, request),
    ).rejects.toThrow('once the order is delivered');

    const late = setup({
      order: {
        _id: new Types.ObjectId(orderId),
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 20 * DAY),
      },
    });
    await expect(late.service.create(userId, orderId, request)).rejects.toThrow(
      'The return period (15 days after delivery) has ended',
    );
    expect(late.ReturnRequestModel.create).not.toHaveBeenCalled();
  });

  it("refuses another customer's order", async () => {
    const ctx = setup({ order: null });
    await expect(ctx.service.create(userId, orderId, request)).rejects.toThrow(
      'Order not found',
    );
  });

  it('refuses more than is left to return', async () => {
    const ctx = setup({ remaining: [0, 1] });
    await expect(ctx.service.create(userId, orderId, request)).rejects.toThrow(
      'only 0 left to return',
    );
  });

  it('refuses a second request while one is pending', async () => {
    const ctx = setup();
    ctx.ReturnRequestModel.create.mockRejectedValueOnce({ code: 11000 });
    await expect(ctx.service.create(userId, orderId, request)).rejects.toThrow(
      'already waiting for review',
    );
  });
});

describe('OrderReturnRequestService: the decision', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("approves with the request's reason and lines, then marks it approved", async () => {
    const ctx = setup();
    await ctx.service.approve(orderId, requestId, {}, admin);

    expect(ctx.orderCreditNoteService.createFromAdmin).toHaveBeenCalledWith(
      orderId,
      {
        lines: ctx.pending.lines,
        reason: ctx.pending.note,
        reasonType: 'defect',
        restock: true,
        returnRequest: ctx.pending._id,
      },
      admin,
    );
    expect(ctx.ReturnRequestModel.updateOne).toHaveBeenCalledWith(
      { _id: ctx.pending._id },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'approved',
          creditNote: ctx.note._id,
        }) as unknown,
      }),
    );
  });

  it('lets the admin change the quantities', async () => {
    const ctx = setup();
    const lines = [{ itemIndex: 1, quantity: 1 }];
    await ctx.service.approve(
      orderId,
      requestId,
      { lines, restock: false },
      admin,
    );
    expect(ctx.orderCreditNoteService.createFromAdmin).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ lines, restock: false }),
      admin,
    );
  });

  it('leaves the request pending when the refund fails', async () => {
    const ctx = setup();
    ctx.orderCreditNoteService.createFromAdmin.mockRejectedValueOnce(
      new Error('Moyasar declined'),
    );
    await expect(
      ctx.service.approve(orderId, requestId, {}, admin),
    ).rejects.toThrow('Moyasar declined');
    expect(ctx.ReturnRequestModel.updateOne).toHaveBeenCalledWith(
      { _id: ctx.pending._id },
      { $unset: { processingUntil: 1 } },
    );
  });

  it('refuses a second approval while one is running', async () => {
    const ctx = setup();
    ctx.ReturnRequestModel.findOneAndUpdate.mockReturnValueOnce(query(null));
    ctx.ReturnRequestModel.exists.mockResolvedValueOnce({ _id: 1 } as never);
    await expect(
      ctx.service.approve(orderId, requestId, {}, admin),
    ).rejects.toThrow('being approved');
    expect(ctx.orderCreditNoteService.createFromAdmin).not.toHaveBeenCalled();
  });

  it('rejects with a reason and emails it to the customer', async () => {
    const ctx = setup();
    await ctx.service.reject(orderId, requestId, 'Opened and used', admin);
    expect(ctx.orderEmailService.sendReturnRejectedEmail).toHaveBeenCalledWith(
      { invoiceNumber: 42 },
      { email: 'a@b.c', name: 'Ali' },
      'Opened and used',
    );
  });
});
