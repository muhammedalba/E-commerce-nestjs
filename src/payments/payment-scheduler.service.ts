import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
} from './shared/schemas/payment-transaction.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentStatus } from './shared/enums/payment-status.enum';

const PENDING_STATUSES = [PaymentStatus.INITIATED, PaymentStatus.PENDING];

@Injectable()
export class PaymentSchedulerService {
  private readonly logger = new Logger(PaymentSchedulerService.name);

  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly paymentTransactionModel: Model<PaymentTransactionDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkExpiredPayments() {
    // this.logger.debug('Running checkExpiredPayments cron job...');

    // Threshold: payments created more than 15 minutes ago
    const expirationThreshold = new Date();
    expirationThreshold.setMinutes(expirationThreshold.getMinutes() - 15);

    try {
      const candidates = await this.paymentTransactionModel
        .find({
          status: { $in: PENDING_STATUSES },
          createdAt: { $lt: expirationThreshold },
        })
        .select('_id')
        .lean();

      for (const { _id } of candidates) {
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

        this.logger.log(`Marking transaction ${transaction._id} as EXPIRED`);

        this.eventEmitter.emit('payment.expired', {
          orderId: transaction.orderId,
          transactionId: transaction.id,
        });
      }
    } catch (error: any) {
      this.logger.error(
        `Error in checkExpiredPayments: ${error.message}`,
        error.stack,
      );
    }
  }
}
