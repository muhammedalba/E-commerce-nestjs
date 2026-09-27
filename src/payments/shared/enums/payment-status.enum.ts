export enum PaymentStatus {
  INITIATED = 'INITIATED',
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  /** The full amount was refunded (or the payment voided) in Moyasar. */
  REFUNDED = 'REFUNDED',
  /** Part of a paid amount was refunded; the order goes on. */
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  EXPIRED = 'EXPIRED',
}
