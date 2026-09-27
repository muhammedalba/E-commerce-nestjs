import { PaymentType } from '../schema/payment-method.schema';

/** Method types that charge the customer online and so need a gateway integration. */
export const ONLINE_PAYMENT_TYPES = [
  PaymentType.CARD,
  PaymentType.WALLET,
  PaymentType.BUY_NOW_PAY_LATER,
];

/**
 * Method codes with a real gateway integration (the strategies in
 * CheckoutOrchestratorService). An online method with any other code would
 * create an order that is never charged, so it is hidden and rejected.
 */
export const SUPPORTED_ONLINE_PAYMENT_CODES = ['moyasar'];
