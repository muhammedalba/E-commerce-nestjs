/**
 * Customer-facing reason groups for a failed card payment.
 *
 * Only the category ever leaves the server. The raw issuer message stays in
 * the transaction metadata: codes like 41 (lost card) or 43 (stolen card) must
 * not be shown to the payer, so they fall into the generic `declined` group.
 */
export type PaymentFailureCategory =
  | 'insufficient_funds'
  | 'card_expired'
  | 'authentication'
  | 'declined';

const INSUFFICIENT_FUNDS_CODES = new Set(['51', '61']);
const CARD_EXPIRED_CODES = new Set(['54']);

/**
 * Maps the `source` of a failed Moyasar payment to a failure category.
 * Issuer declines carry an ISO 8583 `response_code`; 3-D Secure failures have
 * none, so they are recognized by their message. The message is also checked
 * for the issuer cases in case `response_code` is absent.
 */
export function classifyPaymentFailure(source?: {
  message?: unknown;
  response_code?: unknown;
}): PaymentFailureCategory {
  const code =
    typeof source?.response_code === 'string' ? source.response_code : '';
  const message =
    typeof source?.message === 'string' ? source.message.toUpperCase() : '';

  if (
    INSUFFICIENT_FUNDS_CODES.has(code) ||
    message.includes('INSUFFICIENT FUNDS') ||
    message.includes('EXCEEDS WITHDRAWAL LIMIT')
  ) {
    return 'insufficient_funds';
  }
  if (CARD_EXPIRED_CODES.has(code) || message.includes('EXPIRED CARD')) {
    return 'card_expired';
  }
  if (
    message.includes('3DS') ||
    message.includes('AUTHENTICATION') ||
    message.includes('NOT ENROLLED')
  ) {
    return 'authentication';
  }
  return 'declined';
}
