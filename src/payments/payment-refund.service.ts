import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
} from './shared/schemas/payment-transaction.schema';
import { PaymentStatus } from './shared/enums/payment-status.enum';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PaymentTransactionService } from './payment-transaction.service';
import { AuditService } from 'src/audit/audit.service';
import { AuditAction } from 'src/audit/shared/schema/audit-log.schema';
import { fromMinorUnits, toMinorUnits } from './shared/utils/currency.util';

export interface RefundResult {
  /** Amount refunded by this request, in major units. */
  refundedNow: number;
  /** Cumulative refunded total, in major units. */
  refundedAmount: number;
  isFull: boolean;
}

/**
 * Refunds from the admin dashboard. The refund is made through the Moyasar
 * API, then recorded through the same path as a refund made in the Moyasar
 * dashboard (PaymentTransactionService.processMoyasarRefund → payment.refunded
 * → order cancelled/restocked or refund recorded, customer emailed). The
 * webhook Moyasar sends afterwards changes nothing: the total did not rise.
 */
@Injectable()
export class PaymentRefundService {
  private readonly logger = new Logger(PaymentRefundService.name);

  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly transactionModel: Model<PaymentTransactionDocument>,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly paymentTransactionService: PaymentTransactionService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * @param amount Major units; omitted refunds everything not yet refunded.
   * @throws {BadRequestException} No refundable online payment, an amount
   * outside (0, remaining], or Moyasar rejected the refund.
   * @throws {ServiceUnavailableException} Moyasar unreachable (nothing refunded).
   */
  async refundOrder(
    orderId: string,
    { amount, reason }: { amount?: number; reason: string },
    admin: { id: string; email?: string },
  ): Promise<RefundResult> {
    const transaction = await this.transactionModel
      .findOne({
        orderId: new Types.ObjectId(orderId),
        status: {
          $in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED],
        },
        providerPaymentId: { $ne: null },
      })
      .sort({ createdAt: -1 });
    if (!transaction?.providerPaymentId) {
      throw new BadRequestException(
        'This order has no online payment that can be refunded',
      );
    }

    // Work in integer minor units so partial refunds never drift by rounding.
    const currency = transaction.currency || 'SAR';
    const paidMinor = toMinorUnits(transaction.amount, currency);
    const refundedBeforeMinor = toMinorUnits(
      transaction.refundedAmount ?? 0,
      currency,
    );
    const remainingMinor = paidMinor - refundedBeforeMinor;
    const requestedMinor =
      amount === undefined ? remainingMinor : toMinorUnits(amount, currency);
    if (requestedMinor <= 0 || requestedMinor > remainingMinor) {
      throw new BadRequestException(
        `Refund amount must be more than 0 and at most ${fromMinorUnits(remainingMinor, currency)} ${currency}`,
      );
    }

    const payment = await this.providerFactory
      .getMoyasarProvider()
      .refundPayment(transaction.providerPaymentId, requestedMinor);

    // The money has moved: from here on, failures are logged, not thrown, so
    // the admin is not told to retry a refund that already happened. The
    // payment_refunded webhook records it if this step failed.
    try {
      await this.paymentTransactionService.processMoyasarRefund(payment);
    } catch (err: unknown) {
      this.logger.error(
        `Refund ${transaction.providerPaymentId} succeeded on Moyasar but was not recorded yet (the webhook will retry): ${(err as Error).message}`,
      );
    }

    const refundedTotalMinor = Number(
      payment.refunded ?? refundedBeforeMinor + requestedMinor,
    );
    const result: RefundResult = {
      refundedNow: fromMinorUnits(requestedMinor, currency),
      refundedAmount: fromMinorUnits(refundedTotalMinor, currency),
      isFull: refundedTotalMinor >= paidMinor,
    };

    try {
      await this.auditService.log({
        action: AuditAction.PAYMENT_REFUNDED,
        module: 'PAYMENT',
        userId: admin.id,
        userEmail: admin.email ?? '',
        previousData: {
          orderId,
          transactionId: transaction._id.toString(),
          refundedAmount: fromMinorUnits(refundedBeforeMinor, currency),
        },
        newData: {
          orderId,
          transactionId: transaction._id.toString(),
          providerPaymentId: transaction.providerPaymentId,
          ...result,
          currency,
          reason,
        },
      });
    } catch (err: unknown) {
      this.logger.error(
        `Refund on order ${orderId} succeeded but its audit log failed: ${(err as Error).message}`,
      );
    }

    return result;
  }
}
