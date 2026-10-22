import { Injectable, Logger } from '@nestjs/common';
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
   * The order number customers and admins see (e.g. "0042"), like the
   * storefront's formatOrderNumber: the invoice serial, else the last 6 chars
   * of `_id` (orders from before the counter).
   */
  private displayOrderNumber(
    invoiceNumber: number | null | undefined,
    id: { toString(): string },
  ): string {
    // String(undefined) is "undefined" (truthy): test the number itself
    return invoiceNumber != null
      ? String(invoiceNumber).padStart(4, '0')
      : id.toString().slice(-6).toUpperCase();
  }

  private currentLang(): string {
    return I18nContext.current()?.lang || process.env.DEFAULT_LANGUAGE || 'ar';
  }

  /**
   * What both order emails show, in `lang`. Built from the lines stored on the
   * order (snapshot taken at checkout), not from the live catalog: a product
   * edited or deactivated since still shows.
   */
  private async orderSummary(order: OrderDocument, lang: string) {
    const settings = await this.settingsService.getSettings().catch(() => null);
    return {
      currency: this.currencyLabel(order.currency, settings, lang),
      date: this.formatOrderDate(order.createdAt, settings, lang),
      amount: order.grandTotal?.toString() ?? order.totalPrice.toString(),
      orderId: this.displayOrderNumber(order.invoiceNumber, order._id),
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
        totalPrice: (item.totalPrice ?? item.price * item.quantity).toString(),
      })),
    };
  }

  /**
   * Tells the admin about a new (confirmed) order. Queued; a failure is
   * logged, not thrown: a notification must never undo the order.
   */
  async sendOrderEmail(order: OrderDocument, user_email: string) {
    const lang = this.currentLang();
    try {
      await this.mailQueue.add('new-admin-order', {
        ...(await this.orderSummary(order, lang)),
        appName: process.env.APP_NAME || 'admin',
        email: user_email,
        // Admin email: opens the order in the dashboard
        url: `${process.env.CLIENT_URL}/${lang}/dashboard/orders/${order._id?.toString() ?? ''}`,
        subject: this.i18n.translate('email.NEW_ORDER_SUBJECT', {
          args: { name: user_email },
          lang,
        }),
        lang,
      });
    } catch (err) {
      this.logger.error(
        `Failed to queue admin email for order ${order._id.toString()}`,
        err,
      );
    }
  }

  /**
   * Confirms a new order to the customer, at the same point as the admin
   * email (created for COD, paid for Moyasar). Queued; a failure is logged,
   * not thrown: it must never undo the order.
   */
  async sendCustomerOrderEmail(
    order: OrderDocument,
    customer: { email: string; name?: string },
  ) {
    const lang = this.currentLang();
    try {
      const summary = await this.orderSummary(order, lang);
      await this.mailQueue.add('new-order-customer', {
        ...summary,
        email: customer.email,
        name: customer.name ?? '',
        orderUrl: `${process.env.CLIENT_URL}/${lang}/account/orders/${order._id.toString()}`,
        // The mail job issues the tax invoice and attaches it
        orderMongoId: order._id.toString(),
        subject: this.i18n.translate('email.ORDER_CONFIRMATION_SUBJECT', {
          args: { number: summary.orderId },
          lang,
        }),
        lang,
      });
    } catch (err) {
      this.logger.error(
        `Failed to queue confirmation email for order ${order._id.toString()}`,
        err,
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
    invoiceNumber?: number | null;
    refundedAmount: number;
    currency: string;
    isFull: boolean;
    cancelled: boolean;
  }) {
    const lang = process.env.DEFAULT_LANGUAGE || 'ar';
    try {
      await this.mailQueue.add('order-refunded', {
        ...refund,
        // Shown in the email; `orderId` (_id) stays for the order page link
        invoiceNumber: this.displayOrderNumber(
          refund.invoiceNumber,
          refund.orderId,
        ),
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
