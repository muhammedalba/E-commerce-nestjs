/**
 * Payload of `payment.refunded`, emitted by PaymentTransactionService when a
 * refund or void made in the Moyasar dashboard is recorded. Handled by
 * OrderService.handlePaymentRefunded.
 */
export interface PaymentRefundedEvent {
  orderId: string;
  userId?: string;
  transactionId: string;
  /** Cumulative refunded total, in major units. */
  refundedAmount: number;
  currency: string;
  /** The whole paid amount has now been refunded (or the payment voided). */
  isFull: boolean;
}
