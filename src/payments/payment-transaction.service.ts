/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
} from './shared/schemas/payment-transaction.schema';
import { CreatePaymentDto } from './shared/dto/create-payment.dto';
import { PaymentStatus } from './shared/enums/payment-status.enum';
import { PaymentProvider } from './shared/enums/payment-provider.enum';
import { MoyasarProvider } from './providers/moyasar.provider';
import { Order } from 'src/order/shared/schemas/Order.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PaymentTransactionService {
  private readonly logger = new Logger(PaymentTransactionService.name);

  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly transactionModel: Model<PaymentTransactionDocument>,
    @InjectModel('Order') private readonly orderModel: Model<Order>,
    private readonly moyasarProvider: MoyasarProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async initiatePayment(
    createDto: CreatePaymentDto,
    userEmail: string,
  ): Promise<{ paymentUrl?: string; transactionId: string }> {
    // 1. Create Transaction as INITIATED
    const transaction = new this.transactionModel({
      orderId: new Types.ObjectId(createDto.orderId),
      // userId is not in createDto currently? Wait, we need it.
      // Let's pass userId in createDto or separately. I will assume it's passed.
      userId: new Types.ObjectId((createDto as any).userId), // we will fix DTO later if needed
      provider: createDto.provider,
      amount: createDto.amount,
      currency: createDto.currency,
      status: PaymentStatus.INITIATED,
    });

    await transaction.save();

    // 2. Call Provider
    let sessionResult;
    if (createDto.provider === PaymentProvider.MOYASAR) {
      sessionResult = await this.moyasarProvider.createSession(
        createDto.orderId,
        createDto.amount,
        createDto.currency,
        userEmail,
        { transactionId: transaction._id.toString() },
      );
    } else {
      throw new BadRequestException('Unsupported payment provider');
    }

    // 3. Handle Provider Response
    if (sessionResult.status === 'FAILED') {
      transaction.status = PaymentStatus.FAILED;
      transaction.failedAt = new Date();
      transaction.metadata = { error: sessionResult.errorMessage };
      await transaction.save();
      throw new BadRequestException(
        `Payment initiation failed: ${sessionResult.errorMessage}`,
      );
    }

    // Success
    transaction.status = PaymentStatus.PENDING;
    transaction.providerPaymentId = sessionResult.providerPaymentId;
    transaction.paymentUrl = sessionResult.paymentUrl;
    await transaction.save();

    return {
      paymentUrl: sessionResult.paymentUrl,
      transactionId: transaction._id.toString(),
    };
  }

  async processMoyasarWebhook(payload: any) {
    const providerPaymentId = payload.id;
    const paymentStatus = payload.status; // 'paid', 'failed', etc.
    const orderId = payload.metadata?.orderId;

    let transaction;

    // First try by providerPaymentId (if it was already saved)
    if (providerPaymentId) {
      transaction = await this.transactionModel.findOne({ providerPaymentId });
    }

    // If not found, fall back to finding by orderId (since frontend creates the payment)
    if (!transaction && orderId) {
      transaction = await this.transactionModel.findOne({
        orderId: new Types.ObjectId(orderId),
        status: { $in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
      });
      // Save the providerPaymentId to link it
      if (transaction) {
        transaction.providerPaymentId = providerPaymentId;
        await transaction.save();
      }
    }

    if (!transaction) {
      this.logger.warn(
        `Webhook received for unknown Moyasar payment: ${providerPaymentId} (orderId: ${orderId})`,
      );
      return;
    }

    // Security Check: Validate Amount
    // Moyasar payload.amount is in halalas (e.g. 10000 for 100 SAR)
    const expectedAmountHalalas = Math.round(transaction.amount * 100);
    if (payload.amount !== expectedAmountHalalas) {
      this.logger.error(
        `Amount mismatch for order ${orderId}! Expected ${expectedAmountHalalas}, got ${payload.amount}`,
      );
      // Mark as failed due to tampered amount
      transaction.status = PaymentStatus.FAILED;
      transaction.failedAt = new Date();
      transaction.metadata = {
        ...transaction.metadata,
        failureReason: 'Amount mismatch detected',
      };
      await transaction.save();
      return;
    }

    // Idempotency check
    if (
      transaction.status === PaymentStatus.PAID ||
      transaction.status === PaymentStatus.FAILED
    ) {
      this.logger.log(
        `Webhook ignored: Transaction ${transaction._id} is already ${transaction.status}`,
      );
      return;
    }

    if (paymentStatus === 'paid') {
      transaction.status = PaymentStatus.PAID;
      transaction.paidAt = new Date();
      await transaction.save();

      // Emit event for Order Service to handle stock and status updates
      this.eventEmitter.emit('payment.succeeded', {
        orderId: transaction.orderId.toString(),
        transactionId: transaction._id.toString(),
        provider: transaction.provider,
        amount: transaction.amount,
      });
    } else if (paymentStatus === 'failed') {
      transaction.status = PaymentStatus.FAILED;
      transaction.failedAt = new Date();
      transaction.metadata = {
        ...transaction.metadata,
        failureReason: payload.message,
      };
      await transaction.save();

      this.eventEmitter.emit('payment.failed', {
        orderId: transaction.orderId.toString(),
        reason: payload.message || 'Payment failed',
      });
    }
  }

  async verifyPaymentStatus(providerPaymentId: string): Promise<{
    orderId: string;
    orderStatus?: string;
    paymentStatus: string;
    amount: number;
    currency: string;
  }> {
    // 1. Fetch payment directly from Moyasar to guarantee truth
    const payment = await this.moyasarProvider.fetchPayment(providerPaymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found on Moyasar');
    }

    const metadata = payment.metadata as Record<string, unknown> | undefined;
    const orderId = metadata?.orderId as string | undefined;
    if (!orderId) {
      throw new BadRequestException(
        'Payment does not contain orderId metadata',
      );
    }

    // 2. Find internal transaction
    let transaction = await this.transactionModel
      .findOne({ orderId: new Types.ObjectId(orderId) })
      .sort({ createdAt: -1 });

    if (!transaction) {
      throw new NotFoundException('Payment transaction not found in database');
    }

    // Actively process it if status is not final
    if (
      transaction.status === PaymentStatus.PENDING ||
      transaction.status === PaymentStatus.INITIATED
    ) {
      if (
        payment.status === 'paid' ||
        payment.status === 'failed' ||
        payment.status === 'expired'
      ) {
        // Reuse webhook logic safely
        await this.processMoyasarWebhook(payment);
        // Refresh transaction from DB
        const updated = await this.transactionModel.findById(transaction._id);
        if (updated) {
          transaction = updated;
        }
      }
    }

    const order = await this.orderModel.findById(transaction.orderId);

    return {
      orderId: transaction.orderId.toString(),
      orderStatus: order?.status,
      paymentStatus: transaction.status, // INITIATED, PENDING, PAID, FAILED
      amount: transaction.amount,
      currency: transaction.currency,
    };
  }

  async retryPayment(
    orderId: string,
    userId: string,
    userEmail: string,
  ): Promise<{ paymentUrl: string }> {
    // 1. Validation gates
    const order = await this.orderModel.findOne({ _id: orderId, user: userId });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== 'pending_payment') {
      throw new BadRequestException(
        `Cannot retry payment for order in status: ${order.status}`,
      );
    }
    if (order.paymentStatus === 'paid') {
      throw new BadRequestException('Order is already paid');
    }

    // 2. Cancel old transactions
    await this.transactionModel.updateMany(
      {
        orderId,
        status: { $in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
      },
      { $set: { status: PaymentStatus.CANCELLED } },
    );

    // 3. Issue new payment
    const createDto: CreatePaymentDto = {
      orderId,
      userId,
      provider: PaymentProvider.MOYASAR,
      amount: order.grandTotal,
      currency: order.currency,
    };

    const result = await this.initiatePayment(createDto, userEmail);
    if (!result.paymentUrl) {
      throw new BadRequestException('Failed to generate new payment URL');
    }
    return { paymentUrl: result.paymentUrl };
  }
}
