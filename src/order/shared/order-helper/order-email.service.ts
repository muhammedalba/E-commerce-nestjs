import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HydratedDocument } from 'mongoose';
import { Order } from '../schemas/Order.schema';
import { withBaseUrl } from 'src/shared/utils/with-base-url.util';
import { SettingsService } from 'src/settings/settings.service';
import { Setting } from 'src/settings/shared/schema/setting.schema';
import { resolveStoreTimezone } from 'src/backup/store-timezone';

type OrderDocument = HydratedDocument<Order>;

@Injectable()
export class OrderEmailService {
  private readonly logger = new Logger(OrderEmailService.name);

  constructor(
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
    private readonly i18n: I18nService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * The order's currency (the store's at checkout) as shown in an email: the
   * store's symbol (e.g. ر.س) in Arabic while it is still the store currency,
   * otherwise — and always in English — its code (SAR).
   */
  private currencyLabel(
    orderCurrency: string | undefined,
    settings: Setting | null,
    lang: string,
  ): string {
    const code = orderCurrency || settings?.currencyCode || 'SAR';
    return lang === 'ar' &&
      code === settings?.currencyCode &&
      settings.currencySymbol
      ? settings.currencySymbol
      : code;
  }

  /** Order date in the email's language, in the store's timezone. */
  private formatOrderDate(
    date: Date | undefined,
    settings: Setting | null,
    lang: string,
  ): string {
    if (!date) return '';
    const { timezone } = resolveStoreTimezone(
      settings?.businessAddress,
      'Asia/Riyadh',
    );
    return new Intl.DateTimeFormat(
      // Gregorian calendar and Latin digits, like the storefront
      lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-US',
      { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone },
    ).format(date);
  }

  /**
   * Built from the lines stored on the order (snapshot taken at checkout), not
   * from the live catalog: a product edited or deactivated since still shows.
   */
  async sendOrderEmail(order: OrderDocument, user_email: string) {
    const lang =
      I18nContext.current()?.lang || process.env.DEFAULT_LANGUAGE || 'ar';
    try {
      const settings = await this.settingsService
        .getSettings()
        .catch(() => null);
      await this.mailQueue.add('new-admin-order', {
        appName: process.env.APP_NAME || 'admin',
        currency: this.currencyLabel(order.currency, settings, lang),
        email: user_email,
        date: this.formatOrderDate(order.createdAt, settings, lang),
        amount: order.grandTotal?.toString() ?? order.totalPrice.toString(),
        // Admin email: opens the order in the dashboard
        url: `${process.env.CLIENT_URL}/${lang}/dashboard/orders/${order._id?.toString() ?? ''}`,
        // String(undefined) is "undefined" (truthy): test the number itself
        orderId:
          order.invoiceNumber != null
            ? String(order.invoiceNumber).padStart(4, '0')
            : order._id.toString().slice(-6).toUpperCase(),
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
            // Local uploads store a relative path; an email needs an absolute URL
            imageCover:
              withBaseUrl(
                typeof item.image === 'string' ? item.image : item.image?.url,
              ) ?? '',
          },
          quantity: item.quantity.toString(),
          totalPrice: (
            item.totalPrice ?? item.price * item.quantity
          ).toString(),
        })),
        subject: this.i18n.translate('email.NEW_ORDER_SUBJECT', {
          args: { name: user_email },
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
