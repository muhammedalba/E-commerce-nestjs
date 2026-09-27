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
import {
  classifyPaymentFailure,
  PaymentFailureCategory,
} from './shared/utils/payment-failure.util';
import { PaymentProvider } from './shared/enums/payment-provider.enum';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { Order } from 'src/order/shared/schemas/Order.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus } from 'src/order/shared/enums/order-status.enum';

/**
 * Normalizes a currency code exactly like the checkout page does before it
 * calls Moyasar.init, so a store currency set as 'ر.س' or 'sar' still matches
 * the 'SAR' Moyasar reports.
 */
function normalizeCurrency(currency: unknown): string {
  const code = (typeof currency === 'string' ? currency : '')
    .toUpperCase()
    .trim();
  return code === 'ر.س' || code === 'ر.س.' ? 'SAR' : code;
}

/**
 * Service responsible for managing the lifecycle of payment transactions.
 * Handles initiating payments, processing webhooks, verifying payment statuses directly with providers,
 * and retrying failed or pending payments.
 */
@Injectable()
export class PaymentTransactionService {
  private readonly logger = new Logger(PaymentTransactionService.name);

  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly transactionModel: Model<PaymentTransactionDocument>,
    @InjectModel('Order') private readonly orderModel: Model<Order>,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Initiates a new payment transaction for a given order.
   * Creates a transaction record with INITIATED status and requests a payment session
   * from the designated payment provider (e.g., Moyasar).
   *
   * @param {CreatePaymentDto} createDto - Data transfer object containing order and payment details.
   * @param {string} userEmail - The email address of the user initiating the payment.
   * @returns {Promise<{ paymentUrl?: string; transactionId: string }>} A promise that resolves to the generated payment URL and internal transaction ID.
   * @throws {BadRequestException} If the selected payment provider is not supported or initiation fails.
   */
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
    const providerInstance = this.providerFactory.getProvider(
      createDto.provider,
    );
    const sessionResult = await providerInstance.createSession(
      createDto.orderId,
      createDto.amount,
      createDto.currency,
      userEmail,
      { transactionId: transaction._id.toString() },
    );

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

  /**
   * Processes an incoming webhook payload from Moyasar.
   * Validates the payload amount against the internal transaction record to prevent tampering.
   * Updates the transaction status and emits application events (e.g., payment.succeeded, payment.failed)
   * to trigger subsequent business logic like stock reservation and order fulfillment.
   *
   * @param {any} payload - The raw webhook payload received from Moyasar.
   * @returns {Promise<void>}
   */
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

    // Paid after its transaction expired (15-min cron) or was cancelled by a
    // retry, and never linked: record the capture instead of dropping it as
    // unknown. payment.succeeded then flags the order for manual refund/review,
    // since its reservation was already released.
    if (!transaction && orderId && paymentStatus === 'paid') {
      transaction = await this.transactionModel
        .findOne({
          orderId: new Types.ObjectId(orderId),
          status: { $in: [PaymentStatus.EXPIRED, PaymentStatus.CANCELLED] },
          providerPaymentId: null,
        })
        .sort({ createdAt: -1 });
      if (transaction) {
        this.logger.warn(
          `Late payment ${providerPaymentId} for ${transaction.status} transaction ${transaction._id} (order ${orderId})`,
        );
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
      await this.failMismatchedPayment(
        transaction._id,
        'Amount mismatch detected',
      );
      return;
    }

    // Security Check: Validate Currency (set by the browser, like the amount)
    const expectedCurrency = normalizeCurrency(transaction.currency || 'SAR');
    const paidCurrency = normalizeCurrency(payload.currency);
    if (paidCurrency !== expectedCurrency) {
      this.logger.error(
        `Currency mismatch for order ${orderId}! Expected ${expectedCurrency}, got ${paidCurrency}`,
      );
      await this.failMismatchedPayment(
        transaction._id,
        'Currency mismatch detected',
      );
      return;
    }

    if (paymentStatus === 'paid') {
      const updated = await this.transitionIfNotFinal(transaction._id, {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      });
      if (!updated) return;
      // Emit event for Order Service to handle stock and status updates
      this.eventEmitter.emit('payment.succeeded', {
        orderId: updated.orderId.toString(),
        userId: updated.userId?.toString(),
        transactionId: updated._id.toString(),
        provider: updated.provider,
        amount: updated.amount,
      });
    } else if (paymentStatus === 'failed') {
      // Moyasar puts the issuer / 3DS outcome on the payment source.
      const source = payload.source as
        | { message?: unknown; response_code?: unknown }
        | undefined;
      const failureReason =
        (typeof source?.message === 'string' && source.message) ||
        (typeof payload.message === 'string' && payload.message) ||
        undefined;
      const updated = await this.transitionIfNotFinal(transaction._id, {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        'metadata.failureReason': failureReason,
        'metadata.failureCode': source?.response_code,
        'metadata.failureCategory': classifyPaymentFailure(source),
      });
      if (!updated) return;

      this.eventEmitter.emit('payment.failed', {
        orderId: updated.orderId.toString(),
        userId: updated.userId?.toString(),
        reason: failureReason || 'Payment failed',
      });
    }
  }

  /**
   * Fails a transaction whose payment does not match it (amount or currency)
   * and emits payment.failed, so the order is cancelled and its reserved stock
   * released instead of staying pending until the customer checks out again.
   * Business decision: this also applies when someone else pays an order with
   * a wrong amount (it requires knowing the order id).
   */
  private async failMismatchedPayment(
    transactionId: Types.ObjectId,
    reason: string,
  ): Promise<void> {
    const updated = await this.transitionIfNotFinal(transactionId, {
      status: PaymentStatus.FAILED,
      failedAt: new Date(),
      'metadata.failureReason': reason,
    });
    if (!updated) return;

    this.eventEmitter.emit('payment.failed', {
      orderId: updated.orderId.toString(),
      userId: updated.userId?.toString(),
      reason,
    });
  }

  /**
   * Atomically applies `set` unless the transaction is already PAID or FAILED.
   *
   * The Moyasar webhook and the callback page's verify call both process every
   * payment, often at the same moment. The status condition in the filter makes
   * exactly one of them win, so payment.succeeded / payment.failed (which confirm
   * or release reserved stock) are emitted at most once per transaction.
   *
   * @returns The updated transaction, or null when it was already final.
   */
  private async transitionIfNotFinal(
    transactionId: Types.ObjectId,
    set: Record<string, unknown>,
  ): Promise<PaymentTransactionDocument | null> {
    const updated = await this.transactionModel.findOneAndUpdate(
      {
        _id: transactionId,
        status: { $nin: [PaymentStatus.PAID, PaymentStatus.FAILED] },
      },
      { $set: set },
      { new: true },
    );
    if (!updated) {
      this.logger.log(
        `Webhook ignored: Transaction ${transactionId.toString()} is already final`,
      );
    }
    return updated;
  }

  /**
   * Securely verifies the status of a payment directly with the Moyasar API.
   * This acts as a reliable source of truth, bypassing potential webhook delivery failures
   * or client-side tampering. It updates the internal transaction state if a discrepancy is found.
   *
   * @param {string} providerPaymentId - The unique payment identifier provided by Moyasar.
   * @returns {Promise<{ orderId: string; orderStatus?: string; paymentStatus: string; amount: number; currency: string }>} A promise resolving to the consolidated payment and order status details.
   * @throws {NotFoundException} If the payment or internal transaction cannot be found.
   * @throws {BadRequestException} If the payment payload is missing required metadata like orderId.
   */
  async verifyPaymentStatus(providerPaymentId: string): Promise<{
    orderId: string;
    orderStatus?: string;
    paymentStatus: string;
    failureCategory?: PaymentFailureCategory;
    amount: number;
    currency: string;
  }> {
    // 1. Fetch payment directly from Moyasar to guarantee truth
    const payment = await this.providerFactory
      .getMoyasarProvider()
      .fetchPayment(providerPaymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found on Moyasar');
    }

    const orderId = this.getOrderIdFromPayment(payment);

    // 2. Find internal transaction
    let transaction = await this.transactionModel
      .findOne({ orderId: new Types.ObjectId(orderId) })
      .sort({ createdAt: -1 });

    if (!transaction) {
      throw new NotFoundException('Payment transaction not found in database');
    }

    // Actively process it if status is not final
    const isOpen =
      transaction.status === PaymentStatus.PENDING ||
      transaction.status === PaymentStatus.INITIATED;
    // A capture that arrived after expiry/cancellation must still be recorded
    // (see processMoyasarWebhook); the webhook reaches it through here too.
    const isLatePaid =
      payment.status === 'paid' &&
      (transaction.status === PaymentStatus.EXPIRED ||
        transaction.status === PaymentStatus.CANCELLED);
    if (
      (isOpen &&
        (payment.status === 'paid' ||
          payment.status === 'failed' ||
          payment.status === 'expired')) ||
      isLatePaid
    ) {
      // Reuse webhook logic safely
      await this.processMoyasarWebhook(payment);
      // Refresh transaction from DB
      const updated = await this.transactionModel.findById(transaction._id);
      if (updated) {
        transaction = updated;
      }
    }

    const order = await this.orderModel.findById(transaction.orderId);

    return {
      orderId: transaction.orderId.toString(),
      orderStatus: order?.status,
      paymentStatus: transaction.status, // INITIATED, PENDING, PAID, FAILED
      // Category only: the raw issuer message (e.g. "stolen card") stays server-side.
      failureCategory:
        transaction.status === PaymentStatus.FAILED
          ? (transaction.metadata?.failureCategory as
              | PaymentFailureCategory
              | undefined)
          : undefined,
      amount: transaction.amount,
      currency: transaction.currency,
    };
  }

  /**
   * Links a Moyasar payment to its order's open transaction as soon as the
   * checkout page creates it (before 3DS), so the expiry cron can ask Moyasar
   * about it instead of expiring a payment whose webhook and callback were lost.
   *
   * Nothing from the browser is trusted: the order comes from the payment as
   * Moyasar reports it, and must belong to the caller.
   *
   * @returns `linked: false` when the order has no open transaction.
   * @throws {NotFoundException} If Moyasar has no such payment, or the order is not the caller's.
   * @throws {BadRequestException} If the payment's orderId metadata is missing or invalid.
   */
  async linkMoyasarPayment(
    providerPaymentId: string,
    userId: string,
  ): Promise<{ linked: boolean }> {
    const payment = await this.providerFactory
      .getMoyasarProvider()
      .fetchPayment(providerPaymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found on Moyasar');
    }
    const orderId = this.getOrderIdFromPayment(payment);
    const ownsOrder = await this.orderModel.exists({
      _id: orderId,
      user: userId,
    });
    if (!ownsOrder) {
      throw new NotFoundException('Order not found');
    }

    try {
      // The latest attempt wins: a customer who re-submits the form gets a new
      // payment id. processMoyasarWebhook relinks by order if an earlier one pays.
      const linked = await this.transactionModel.findOneAndUpdate(
        {
          orderId: new Types.ObjectId(orderId),
          status: { $in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
        },
        { $set: { providerPaymentId } },
        { sort: { createdAt: -1 }, new: true },
      );
      return { linked: !!linked };
    } catch (err: unknown) {
      // Unique index: this payment is already tracked by a transaction.
      if ((err as { code?: number }).code === 11000) return { linked: true };
      throw err;
    }
  }

  /**
   * Reads the order id Moyasar stores in the payment metadata. The checkout
   * page sets it, so it is validated here: junk becomes a permanent 4xx rather
   * than an ObjectId cast error (a 500 that Moyasar would keep retrying).
   *
   * @throws {BadRequestException} If the orderId metadata is missing or not an ObjectId.
   */
  private getOrderIdFromPayment(payment: Record<string, unknown>): string {
    const metadata = payment.metadata as Record<string, unknown> | undefined;
    const orderId = metadata?.orderId as string | undefined;
    if (!orderId) {
      throw new BadRequestException(
        'Payment does not contain orderId metadata',
      );
    }
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Payment orderId metadata is invalid');
    }
    return orderId;
  }

  /**
   * Retries a payment for a specific order.
   * Validates if the order is eligible for a retry, cancels any existing pending or initiated transactions
   * to prevent duplicate charges, and initiates a fresh payment session.
   *
   * @param {string} orderId - The unique identifier of the order to retry payment for.
   * @param {string} userId - The unique identifier of the user requesting the retry.
   * @param {string} userEmail - The email address of the user.
   * @returns {Promise<{ paymentUrl: string }>} A promise that resolves to the new payment URL.
   * @throws {NotFoundException} If the order cannot be found or does not belong to the user.
   * @throws {BadRequestException} If the order is already paid or in an invalid state for retry.
   */
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
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Cannot retry payment for order in status: ${order.status}`,
      );
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
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
      provider:
        (order.paymentMethodCode?.toUpperCase() as PaymentProvider) ||
        PaymentProvider.MOYASAR,
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
