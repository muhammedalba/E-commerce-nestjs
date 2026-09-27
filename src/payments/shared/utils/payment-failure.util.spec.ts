import { classifyPaymentFailure } from './payment-failure.util';

// Outcomes of Moyasar's sandbox test cards.
describe('classifyPaymentFailure', () => {
  it.each([
    ['51', 'INSUFFICIENT FUNDS', 'insufficient_funds'],
    ['61', 'DECLINED: EXCEEDS WITHDRAWAL LIMIT', 'insufficient_funds'],
    ['54', 'DECLINED: EXPIRED CARD', 'card_expired'],
    ['05', 'DECLINED', 'declined'],
    ['99', 'UNSPECIFIED FAILURE', 'declined'],
    ['41', 'DECLINED: LOST CARD', 'declined'],
    ['43', 'DECLINED: STOLEN CARD', 'declined'],
    ['05', '‏تم الرفض‏', 'declined'],
  ])('code %s (%s) → %s', (code, message, expected) => {
    expect(classifyPaymentFailure({ response_code: code, message })).toBe(
      expected,
    );
  });

  it.each(['INSUFFICIENT FUNDS', 'DECLINED: EXCEEDS WITHDRAWAL LIMIT'])(
    'falls back to the message without a response code: %s',
    (message) => {
      expect(classifyPaymentFailure({ message })).toBe('insufficient_funds');
    },
  );

  it.each([
    '3DS: attempted but not available, please ensure that you have enabled Online Purchase from your bank portal.',
    '3DS service error occurred.',
    'The card is not enrolled in 3DS service.',
    'The authentication attempt was rejected by the issuer bank.',
    'The authentication is unavailable, please try again later or contact issuer bank if problem persisted.',
  ])('3-D Secure failure → authentication: %s', (message) => {
    expect(classifyPaymentFailure({ message })).toBe('authentication');
  });

  it('never exposes lost/stolen cards as their own category', () => {
    expect(classifyPaymentFailure({ response_code: '43' })).toBe('declined');
    expect(classifyPaymentFailure({ response_code: '41' })).toBe('declined');
  });

  it('defaults to declined when there is no source', () => {
    expect(classifyPaymentFailure(undefined)).toBe('declined');
  });
});
