import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from 'src/roles/shared/schemas/role.schema';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';

/** Emitted by OrderService when a payment lands on an order that is no longer awaiting payment. */
export interface PaymentNeedsReviewPayload {
  orderId: string;
  transactionId: string;
  amount: number;
}

/**
 * Alerts the admins who can refund or update orders when a customer was
 * charged for an order that had already expired or been cancelled (its stock
 * was released). Until someone refunds or fulfils it, the customer has paid
 * for nothing, so a log line alone is not enough.
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
    try {
      const roles = await this.roleModel
        .find({
          permissions: {
            $in: [Permissions.REFUND_ORDER, Permissions.UPDATE_ORDER_STATUS],
          },
        })
        .select('_id')
        .lean();

      // role.notification.* is persisted by NotificationsEventListener and
      // streamed live to the dashboard over SSE.
      for (const role of roles) {
        this.eventEmitter.emit(`role.notification.${role._id.toString()}`, {
          roleId: role._id.toString(),
          action: 'PAYMENT_NEEDS_REVIEW',
          message: {
            ar: `تم تحصيل دفعة بقيمة ${payload.amount} للطلب ${payload.orderId} بعد انتهائه أو إلغائه. يرجى استرجاع المبلغ أو تجهيز الطلب.`,
            en: `A payment of ${payload.amount} was captured for order ${payload.orderId} after it expired or was cancelled. Please refund it or fulfil the order.`,
          },
          payload,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to alert admins about payment ${payload.transactionId} for order ${payload.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
