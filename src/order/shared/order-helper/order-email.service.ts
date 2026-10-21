import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HydratedDocument } from 'mongoose';
import { Order } from '../schemas/Order.schema';

type OrderDocument = HydratedDocument<Order>;

@Injectable()
export class OrderEmailService {
  private readonly logger = new Logger(OrderEmailService.name);

  constructor(
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Built from the lines stored on the order (snapshot taken at checkout), not
   * from the live catalog: a product edited or deactivated since still shows.
   */
  async sendOrderEmail(order: OrderDocument, user_email: string) {
    const lang =
      I18nContext.current()?.lang || process.env.DEFAULT_LANGUAGE || 'ar';
    try {
      await this.mailQueue.add('new-admin-order', {
        appName: process.env.APP_NAME || 'admin',
        email: user_email,
        date: order.createdAt ? order.createdAt.toISOString() : '',
        amount: order.grandTotal?.toString() ?? order.totalPrice.toString(),
        url: `${process.env.BASE_URL}/api/v1/order/${order._id?.toString() ?? ''}`,
        orderId: order._id?.toString() ?? '',
        orderDetails: order.items.map((item) => ({
          product: {
            id: item.productId.toString(),
            title:
              item.title?.[lang as 'ar' | 'en'] ||
              item.title?.ar ||
              item.title?.en ||
              item.sku ||
              '',
            price: item.price.toString(),
            imageCover:
              typeof item.image === 'string'
                ? item.image
                : (item.image?.url ?? ''),
          },
          quantity: item.quantity.toString(),
          totalPrice: (
            item.totalPrice ?? item.price * item.quantity
          ).toString(),
        })),
        subject: this.i18n.translate('email.NEW_ORDER_SUBJECT', {
          args: { name: 'codeProps' },
          lang,
        }),
        lang,
      });
    } catch (err) {
      this.logger.error('Failed to send order email', err);
      throw new BadGatewayException(
        this.i18n.translate('exception.EMAIL_SEND_FAILED'),
      );
    }
  }

  /**
   * Tells the customer about a refund made in the Moyasar dashboard. Queued;
   * a failure is logged, not thrown: the refund is already recorded.
   */
  async sendRefundEmail(refund: {
    email: string;
    orderId: string;
    refundedAmount: number;
    currency: string;
    isFull: boolean;
    cancelled: boolean;
  }) {
    const lang = process.env.DEFAULT_LANGUAGE || 'ar';
    try {
      await this.mailQueue.add('order-refunded', {
        ...refund,
        refundedAmount: refund.refundedAmount.toString(),
        orderUrl: `${process.env.CLIENT_URL}/${lang}/account/orders/${refund.orderId}`,
        subject: this.i18n.translate(
          refund.isFull
            ? 'email.ORDER_REFUNDED_SUBJECT'
            : 'email.ORDER_PARTIALLY_REFUNDED_SUBJECT',
          { lang },
        ),
        lang,
      });
    } catch (err) {
      this.logger.error(
        `Failed to queue refund email for order ${refund.orderId}`,
        err,
      );
    }
  }
}
