import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from 'src/roles/shared/schemas/role.schema';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { PaymentRefundedEvent } from './shared/types/payment-events';

/** Emitted by OrderService when a payment lands on an order that is no longer awaiting payment. */
export interface PaymentNeedsReviewPayload {
  orderId: string;
  transactionId: string;
  amount: number;
}

/**
 * Keeps the admins who can refund or update orders informed about payment
 * events that happen outside the dashboard:
 * - a customer charged for an order that had already expired or been
 *   cancelled (its stock was released): until someone refunds or fulfils it,
 *   the customer has paid for nothing, so a log line alone is not enough;
 * - a refund, which may have been made in the Moyasar dashboard where the
 *   team would otherwise not see it.
 */
@Injectable()
export class PaymentReviewListener {
  private readonly logger = new Logger(PaymentReviewListener.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('payment.needs_review', { async: true })
  async handlePaymentNeedsReview(payload: PaymentNeedsReviewPayload) {
    await this.notifyOrderManagers(
      'PAYMENT_NEEDS_REVIEW',
      {
        ar: `تم تحصيل دفعة بقيمة ${payload.amount} للطلب ${payload.orderId} بعد انتهائه أو إلغائه. يرجى استرجاع المبلغ أو تجهيز الطلب.`,
        en: `A payment of ${payload.amount} was captured for order ${payload.orderId} after it expired or was cancelled. Please refund it or fulfil the order.`,
      },
      payload,
    );
  }

  /**
   * Sent for every recorded refund, whichever dashboard it came from: the
   * wording states the result only, so it is right for both, and the
   * teammates of an admin who refunded from our dashboard learn of it too.
   */
  @OnEvent('payment.refunded', { async: true })
  async handlePaymentRefunded(payload: PaymentRefundedEvent) {
    const amount = `${payload.refundedAmount} ${payload.currency}`;
    await this.notifyOrderManagers(
      'PAYMENT_REFUNDED',
      payload.isFull
        ? {
            ar: `تم استرداد مبلغ الطلب ${payload.orderId} بالكامل (${amount}).`,
            en: `Order ${payload.orderId} was fully refunded (${amount}).`,
          }
        : {
            ar: `تم استرداد جزء من مبلغ الطلب ${payload.orderId}. إجمالي المسترد حتى الآن: ${amount}.`,
            en: `Part of order ${payload.orderId} was refunded. Total refunded so far: ${amount}.`,
          },
      payload,
    );
  }

  /**
   * Notifies every role with REFUND_ORDER or UPDATE_ORDER_STATUS.
   * role.notification.* is persisted by NotificationsEventListener and
   * streamed live to the dashboard over SSE. Never throws: this runs inside
   * event handlers whose failure must not affect the payment flow.
   */
  private async notifyOrderManagers(
    action: string,
    message: { ar: string; en: string },
    payload: { orderId: string; transactionId: string },
  ): Promise<void> {
    try {
      const roles = await this.roleModel
        .find({
          permissions: {
            $in: [Permissions.REFUND_ORDER, Permissions.UPDATE_ORDER_STATUS],
          },
        })
        .select('_id')
        .lean();

      for (const role of roles) {
        this.eventEmitter.emit(`role.notification.${role._id.toString()}`, {
          roleId: role._id.toString(),
          action,
          message,
          payload,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to notify admins (${action}) about payment ${payload.transactionId} for order ${payload.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
