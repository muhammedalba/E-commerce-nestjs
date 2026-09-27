import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
} from './shared/schemas/payment-transaction.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentStatus } from './shared/enums/payment-status.enum';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PaymentTransactionService } from './payment-transaction.service';

const PENDING_STATUSES = [PaymentStatus.INITIATED, PaymentStatus.PENDING];

/**
 * While Moyasar cannot be reached, a linked transaction stays open (it may have
 * been paid), but not past this age: an outage or a bad key must not hold
 * reserved stock forever.
 */
const MAX_PROVIDER_WAIT_MINUTES = 60;

@Injectable()
export class PaymentSchedulerService {
  private readonly logger = new Logger(PaymentSchedulerService.name);

  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly paymentTransactionModel: Model<PaymentTransactionDocument>,
    private readonly eventEmitter: EventEmitter2,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkExpiredPayments() {
    // this.logger.debug('Running checkExpiredPayments cron job...');

    // Threshold: payments created more than 15 minutes ago
    const expirationThreshold = new Date();
    expirationThreshold.setMinutes(expirationThreshold.getMinutes() - 15);

    const providerWaitLimit = new Date(
      Date.now() - MAX_PROVIDER_WAIT_MINUTES * 60_000,
    );

    try {
      const candidates = await this.paymentTransactionModel
        .find({
          status: { $in: PENDING_STATUSES },
          createdAt: { $lt: expirationThreshold },
        })
        .select('_id providerPaymentId createdAt')
        .lean<
          {
            _id: Types.ObjectId;
            providerPaymentId?: string;
            createdAt: Date;
          }[]
        >();

      for (const { _id, providerPaymentId, createdAt } of candidates) {
        // Linked by the checkout page before 3DS: ask Moyasar first, so a
        // payment whose webhook and callback were both lost is settled, not
        // expired. Unlinked transactions cannot be checked and expire as before.
        if (providerPaymentId) {
          const checked = await this.settleFromProvider(providerPaymentId);
          if (!checked && createdAt > providerWaitLimit) continue; // next run
        }

        // Conditional flip: exactly one caller wins per transaction. Another
        // app instance running this same cron, or a webhook that just marked
        // it PAID, makes the update match nothing, so payment.expired (which
        // releases reserved stock) is emitted at most once.
        const transaction = await this.paymentTransactionModel.findOneAndUpdate(
          { _id, status: { $in: PENDING_STATUSES } },
          { $set: { status: PaymentStatus.EXPIRED } },
          { new: true },
        );
        if (!transaction) continue;

        const transactionId = transaction._id.toString();
        this.logger.log(`Marking transaction ${transactionId} as EXPIRED`);

        this.eventEmitter.emit('payment.expired', {
          orderId: transaction.orderId.toString(),
          transactionId,
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Error in checkExpiredPayments: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Applies Moyasar's final outcome (paid/failed) to the transaction, so the
   * expiry flip that follows matches nothing. Any other status (initiated,
   * abandoned) or an unknown payment leaves it to expire.
   *
   * @returns false when Moyasar or the DB could not be reached: keep it open.
   */
  private async settleFromProvider(
    providerPaymentId: string,
  ): Promise<boolean> {
    try {
      const payment = await this.providerFactory
        .getMoyasarProvider()
        .fetchPayment(providerPaymentId);
      if (
        payment &&
        (payment.status === 'paid' || payment.status === 'failed')
      ) {
        await this.paymentTransactionService.processMoyasarWebhook(payment);
      }
      return true;
    } catch (err: unknown) {
      this.logger.warn(
        `Could not check Moyasar payment ${providerPaymentId} before expiry: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
