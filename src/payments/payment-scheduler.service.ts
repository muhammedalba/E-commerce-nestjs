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
      const expiredTransactions = await this.paymentTransactionModel.find({
        status: { $in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
        createdAt: { $lt: expirationThreshold },
      });

      for (const transaction of expiredTransactions) {
        this.logger.log(`Marking transaction ${transaction._id} as EXPIRED`);

        transaction.status = PaymentStatus.EXPIRED;
        await transaction.save();

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
