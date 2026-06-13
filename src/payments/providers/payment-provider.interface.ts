export interface PaymentSessionResult {
  providerPaymentId?: string;
  paymentUrl?: string;
  status: 'PENDING' | 'FAILED';
  errorMessage?: string;
}

export interface IPaymentProvider {
  createSession(
    orderId: string,
    amount: number,
    currency: string,
    userEmail: string,
    metadata?: Record<string, any>,
  ): Promise<PaymentSessionResult>;
}
