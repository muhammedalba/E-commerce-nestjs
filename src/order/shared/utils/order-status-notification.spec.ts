import { orderStatusNotificationAction } from './order-status-notification';

describe('orderStatusNotificationAction', () => {
  it.each([
    ['pending', 'processing', 'ORDER_PROCESSING'],
    ['processing', 'shipped', 'ORDER_SHIPPED'],
    ['shipped', 'delivered', 'ORDER_DELIVERED'],
    ['delivered', 'completed', 'ORDER_COMPLETED'],
    ['processing', 'cancelled', 'ORDER_CANCELED'],
  ])('%s → %s notifies %s', (from, to, action) => {
    expect(orderStatusNotificationAction(from, to)).toBe(action);
  });

  it('stays quiet when the status did not change', () => {
    expect(orderStatusNotificationAction('shipped', 'shipped')).toBeUndefined();
  });

  it('stays quiet when the update has no status', () => {
    expect(orderStatusNotificationAction('shipped', undefined)).toBeUndefined();
  });

  it.each(['pending_payment', 'pending', 'expired'])(
    'stays quiet for the payment-driven status %s',
    (to) => {
      expect(orderStatusNotificationAction('processing', to)).toBeUndefined();
    },
  );
});
