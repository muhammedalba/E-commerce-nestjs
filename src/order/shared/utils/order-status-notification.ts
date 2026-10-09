import { OrderStatus } from '../enums/order-status.enum';

/**
 * Status changes the customer is told about, with their notification action
 * (also the i18n key under `notification.`). Payment-driven statuses
 * (pending_payment, pending, expired) happen while the customer is in the
 * checkout flow and are left out.
 */
const STATUS_ACTIONS: Partial<Record<string, string>> = {
  [OrderStatus.PROCESSING]: 'ORDER_PROCESSING',
  [OrderStatus.SHIPPED]: 'ORDER_SHIPPED',
  [OrderStatus.DELIVERED]: 'ORDER_DELIVERED',
  [OrderStatus.COMPLETED]: 'ORDER_COMPLETED',
  [OrderStatus.CANCELLED]: 'ORDER_CANCELED',
};

/** The action to notify for a status change, or undefined when none. */
export function orderStatusNotificationAction(
  previous: string | undefined,
  next: string | undefined,
): string | undefined {
  if (!next || next === previous) return undefined;
  return STATUS_ACTIONS[next];
}
