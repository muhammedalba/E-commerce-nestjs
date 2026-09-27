import { Types } from 'mongoose';

// Pulls in sharp and the ESM-only uuid; not used by the payment saga.
jest.mock('src/file-upload/file-upload.service', () => ({
  FileUploadService: class {},
}));

import { OrderService } from './order.service';
import { OrderStatus } from './shared/enums/order-status.enum';

/** Mongoose query stand-in: chainable `.select().lean()` and directly awaitable. */
const query = <T>(value: T) => {
  const q = {
    select: () => q,
    lean: () => Promise.resolve(value),
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

const items = [
  {
    productId: new Types.ObjectId(),
    variantId: new Types.ObjectId(),
    quantity: 2,
  },
];
const validatedItems = [{ variant: { id: 'v1' }, product: {}, quantity: 2 }];

const createService = () => {
  const OrderModel = {
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(() => Promise.resolve(null)),
  };
  const UserModel = {
    findById: jest.fn(() => Promise.resolve({ email: 'a@b.c' })),
    findByIdAndUpdate: jest.fn(() => Promise.resolve(null)),
  };
  const orderHelperService = {
    validateOrderItems: jest.fn(() => Promise.resolve({ validatedItems })),
  };
  const productHelperService = {
    reserveStock: jest.fn(() => Promise.resolve()),
    confirmReservation: jest.fn(() => Promise.resolve()),
    releaseReservation: jest.fn(() => Promise.resolve()),
    restockOrderItems: jest.fn(() => Promise.resolve()),
  };
  const couponHelperService = {
    markCouponAsUsed: jest.fn(() => Promise.resolve()),
  };
  const orderEmailService = {
    sendOrderEmail: jest.fn(() => Promise.resolve()),
  };
  const eventEmitter = { emit: jest.fn() };

  const service = new OrderService(
    OrderModel as never,
    UserModel as never,
    {} as never,
    {} as never,
    orderHelperService as never,
    orderEmailService as never,
    productHelperService as never,
    couponHelperService as never,
    {} as never,
    {} as never,
    {} as never,
    eventEmitter as never,
  );

  return {
    service,
    OrderModel,
    UserModel,
    productHelperService,
    couponHelperService,
    eventEmitter,
  };
};

describe('OrderService Moyasar payment saga', () => {
  it('order.moyasar_created only reserves stock (coupon and order count wait for payment)', async () => {
    const { service, productHelperService, couponHelperService, UserModel } =
      createService();

    await service.handleMoyasarOrderCreatedEvent({
      orderId: 'o1',
      userId: new Types.ObjectId().toString(),
      items: [],
      couponDetails: { couponId: new Types.ObjectId().toString() },
    });

    expect(productHelperService.reserveStock).toHaveBeenCalledTimes(1);
    expect(couponHelperService.markCouponAsUsed).not.toHaveBeenCalled();
    expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('payment.failed cancels an awaiting order and releases its reservation once', async () => {
    const { service, OrderModel, productHelperService } = createService();
    OrderModel.findOneAndUpdate
      .mockReturnValueOnce(query({ items, paymentMethodCode: 'moyasar' }))
      .mockReturnValueOnce(query(null)); // already cancelled on the 2nd delivery

    await service.handlePaymentFailed({ orderId: 'o1', reason: 'Declined' });
    await service.handlePaymentFailed({ orderId: 'o1', reason: 'Declined' });

    const [filter, update] = OrderModel.findOneAndUpdate.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(filter.status).toEqual({
      $in: [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT],
    });
    expect(update).toMatchObject({
      status: OrderStatus.CANCELLED,
      paymentStatus: 'FAILED',
    });
    expect(productHelperService.releaseReservation).toHaveBeenCalledTimes(1);
  });

  it('payment.succeeded marks the coupon, counts the order and confirms the reservation', async () => {
    const {
      service,
      OrderModel,
      UserModel,
      productHelperService,
      couponHelperService,
    } = createService();
    const user = new Types.ObjectId();
    const couponId = new Types.ObjectId();
    OrderModel.findOneAndUpdate.mockReturnValueOnce(
      query({ items, user, couponId, paymentMethodCode: 'moyasar' }),
    );

    await service.handlePaymentSucceeded({
      orderId: 'o1',
      transactionId: 't1',
      provider: 'MOYASAR',
      amount: 100,
    });

    expect(couponHelperService.markCouponAsUsed).toHaveBeenCalledWith(
      couponId,
      user.toString(),
    );
    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(user, {
      $inc: { totalOrder: 1 },
    });
    expect(productHelperService.confirmReservation).toHaveBeenCalledTimes(1);
  });

  it('payment.succeeded still confirms the order when the coupon can no longer be marked', async () => {
    const { service, OrderModel, productHelperService, couponHelperService } =
      createService();
    couponHelperService.markCouponAsUsed.mockRejectedValueOnce(
      new Error('ALREADY_USED'),
    );
    OrderModel.findOneAndUpdate.mockReturnValueOnce(
      query({
        items,
        user: new Types.ObjectId(),
        couponId: new Types.ObjectId(),
        paymentMethodCode: 'moyasar',
      }),
    );

    await service.handlePaymentSucceeded({
      orderId: 'o1',
      transactionId: 't1',
      provider: 'MOYASAR',
      amount: 100,
    });

    expect(productHelperService.confirmReservation).toHaveBeenCalledTimes(1);
  });

  it('payment.succeeded for an order no longer awaiting payment records PAID without taking stock', async () => {
    const { service, OrderModel, productHelperService, couponHelperService } =
      createService();
    OrderModel.findOneAndUpdate.mockReturnValueOnce(query(null));

    await service.handlePaymentSucceeded({
      orderId: 'o1',
      transactionId: 't1',
      provider: 'MOYASAR',
      amount: 100,
    });

    expect(OrderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'o1',
      expect.objectContaining({ paymentStatus: 'PAID' }),
    );
    expect(productHelperService.confirmReservation).not.toHaveBeenCalled();
    expect(couponHelperService.markCouponAsUsed).not.toHaveBeenCalled();
  });

  it('checkout.supersedeUnpaidOrders cancels only open Moyasar orders and releases each reservation once', async () => {
    const { service, OrderModel, productHelperService } = createService();
    const userId = new Types.ObjectId().toString();
    OrderModel.find.mockReturnValueOnce(
      query([{ _id: new Types.ObjectId() }, { _id: new Types.ObjectId() }]),
    );
    OrderModel.findOneAndUpdate
      .mockReturnValueOnce(query({ items }))
      .mockReturnValueOnce(query(null)); // paid by a webhook in the meantime

    await service.handleSupersedeUnpaidOrders({ userId });

    const [findFilter] = OrderModel.find.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(findFilter).toMatchObject({ paymentMethodCode: 'moyasar' });
    expect(productHelperService.restockOrderItems).toHaveBeenCalledTimes(1);
    expect(productHelperService.restockOrderItems).toHaveBeenCalledWith(
      items,
      'reserved',
    );
  });
});
