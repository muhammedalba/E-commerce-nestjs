import { Injectable } from '@nestjs/common';
import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { existsSync } from 'fs';
import * as path from 'path';
import { I18nContext } from 'nestjs-i18n';
import {
  BackupFailedJobData,
  CreditNoteCustomerJobData,
  NewOrderCustomerJobData,
  PaymentReceivedJobData,
} from './mail.processor';

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  /**
   * Sends through the mailer after checking the template file exists. The
   * handlebars adapter reads it synchronously inside a nodemailer callback, so
   * a missing file (new template not copied to dist, unexpected lang) was an
   * uncaught exception that killed the whole server. Now it is a normal error:
   * the mail job fails, is retried and reported like any other failure.
   */
  private async sendMail(
    options: ISendMailOptions,
  ): Promise<{ messageId?: string }> {
    if (options.template) {
      // Same directory as the MailerModule template.dir (email.module.ts).
      const file = path.join(__dirname, 'templates', `${options.template}.hbs`);
      if (!existsSync(file)) {
        throw new Error(`Email template not found: ${options.template}.hbs`);
      }
    }
    // The SMTP server's acceptance (its message id), not inbox delivery
    return (await this.mailerService.sendMail(options)) as {
      messageId?: string;
    };
  }
  /**
   * Sends a verification code to the user's email address.
   * @param to - The recipient's email address.
   * @param name - The recipient's name.
   * @param code - The verification code to be sent.
   */

  async sendRandomCode(
    to: string,
    name: string,
    code: string,
    subject: string,
    lang?: string,
  ): Promise<void> {
    const resolvedLang =
      lang ??
      I18nContext.current()?.lang ??
      process.env.DEFAULT_LANGUAGE ??
      'ar';
    const template = `verify-code-${resolvedLang}`;
    console.log(
      `📧 Attempting to send [sendRandomCode] to: ${to} | Lang: ${resolvedLang} | Template: ${template}`,
    );

    await this.sendMail({
      to,
      template,
      subject,
      context: {
        name,
        code,
      },
    });
  }

  async send_reset_password_success(
    to: string,
    name: string,
    supportLink: string,
    loginLink: string,
    subject: string,
    lang?: string,
  ): Promise<void> {
    const resolvedLang =
      lang ??
      I18nContext.current()?.lang ??
      process.env.DEFAULT_LANGUAGE ??
      'ar';
    const template = `reset-pass-${resolvedLang}`;
    console.log(
      `📧 Attempting to send [send_reset_password_success] to: ${to} | Lang: ${resolvedLang} | Template: ${template}`,
    );

    await this.sendMail({
      to,
      subject,
      template,
      context: {
        name,
        supportLink,
        loginLink,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }
  async new_admin_order(
    adminName: string,
    customerName: string,
    orderDate: string,
    orderTotal: string,
    orderLink: string,
    orderId: string,
    products: {
      product: {
        id: string;
        title: string;
        price: string;
        imageCover: string;
      };
      quantity: string;
      totalPrice: string;
    }[],

    subject: string,
    lang?: string,
    currency?: string,
  ): Promise<void> {
    const resolvedLang =
      lang ??
      I18nContext.current()?.lang ??
      process.env.DEFAULT_LANGUAGE ??
      'ar';
    const adminEmail = process.env.ADMIN_EMAIL;
    const template = `new-admin-order-${resolvedLang}`;
    console.log(
      `📧 Attempting to send [new_admin_order] to Admin: ${adminEmail} | Lang: ${resolvedLang} | Template: ${template}`,
    );

    await this.sendMail({
      to: adminEmail,
      subject,
      template,
      context: {
        adminName,
        customerName,
        orderId,
        orderDate,
        orderTotal,
        orderLink,
        products,
        currency: currency || 'SAR',
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  async send_inventory_alert(
    to: string,
    adminName: string,
    productTitle: string,
    sku: string,
    stock: number,
    threshold: number,
    alertType: string,
    subject: string,
    lang?: string,
  ): Promise<void> {
    const resolvedLang =
      lang ??
      I18nContext.current()?.lang ??
      process.env.DEFAULT_LANGUAGE ??
      'ar';
    const template = `inventory-alert-${resolvedLang}`;
    console.log(
      `📧 Attempting to send [send_inventory_alert] to: ${to} | Lang: ${resolvedLang} | Template: ${template}`,
    );

    await this.sendMail({
      to,
      subject,
      template,
      context: {
        subject,
        adminName,
        productTitle,
        sku,
        stock,
        threshold,
        alertType,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  async send_contact_admin_notification(
    name: string,
    email: string,
    phone: string,
    inquiryTypeLabel: string,
    message: string,
    subject: string,
    lang?: string,
  ): Promise<void> {
    const resolvedLang =
      lang ??
      I18nContext.current()?.lang ??
      process.env.DEFAULT_LANGUAGE ??
      'ar';
    const adminEmail = process.env.ADMIN_EMAIL;
    const template = `contact-admin-${resolvedLang}`;
    console.log(
      `📧 Attempting to send [send_contact_admin_notification] to Admin: ${adminEmail} | Lang: ${resolvedLang} | Template: ${template}`,
    );

    await this.sendMail({
      to: adminEmail,
      replyTo: email,
      subject,
      template,
      context: {
        name,
        email,
        phone,
        inquiryTypeLabel,
        message,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  async send_contact_confirmation(
    to: string,
    name: string,
    subject: string,
    lang?: string,
  ): Promise<void> {
    const resolvedLang =
      lang ??
      I18nContext.current()?.lang ??
      process.env.DEFAULT_LANGUAGE ??
      'ar';
    const template = `contact-confirmation-${resolvedLang}`;
    console.log(
      `📧 Attempting to send [send_contact_confirmation] to: ${to} | Lang: ${resolvedLang} | Template: ${template}`,
    );

    await this.sendMail({
      to,
      subject,
      template,
      context: {
        name,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  async send_quote_request_admin_notification(
    customerTypeLabel: string,
    name: string,
    phone: string,
    emails: string[],
    preferredContactMethodLabel: string,
    orderDetails: string,
    deliveryAddress: string,
    commercialRegistrationNumber: string | undefined,
    taxNumber: string | undefined,
    nationalAddress: string | undefined,
    subject: string,
    lang?: string,
  ): Promise<void> {
    const resolvedLang =
      lang ??
      I18nContext.current()?.lang ??
      process.env.DEFAULT_LANGUAGE ??
      'ar';
    const adminEmail = process.env.ADMIN_EMAIL;
    const template = `quote-request-admin-${resolvedLang}`;
    console.log(
      `📧 Attempting to send [send_quote_request_admin_notification] to Admin: ${adminEmail} | Lang: ${resolvedLang} | Template: ${template}`,
    );

    await this.sendMail({
      to: adminEmail,
      replyTo: emails[0],
      subject,
      template,
      context: {
        customerTypeLabel,
        name,
        phone,
        emails: emails.join(', '),
        preferredContactMethodLabel,
        orderDetails,
        deliveryAddress,
        commercialRegistrationNumber,
        taxNumber,
        nationalAddress,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  async send_quote_request_confirmation(
    to: string[],
    name: string,
    subject: string,
    lang?: string,
  ): Promise<void> {
    const resolvedLang =
      lang ??
      I18nContext.current()?.lang ??
      process.env.DEFAULT_LANGUAGE ??
      'ar';
    const template = `quote-request-confirmation-${resolvedLang}`;
    console.log(
      `📧 Attempting to send [send_quote_request_confirmation] to: ${to.join(', ')} | Lang: ${resolvedLang} | Template: ${template}`,
    );

    await this.sendMail({
      to,
      subject,
      template,
      context: {
        name,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  async send_exchange_rate_alert(
    to: string,
    adminName: string,
    currencyCode: string,
    consecutiveFailures: number,
    reason: string,
    subject: string,
    lang?: string,
  ): Promise<void> {
    const resolvedLang =
      lang ??
      I18nContext.current()?.lang ??
      process.env.DEFAULT_LANGUAGE ??
      'ar';
    const template = `exchange-rate-alert-${resolvedLang}`;

    await this.sendMail({
      to,
      subject,
      template,
      context: {
        subject,
        adminName,
        currencyCode,
        consecutiveFailures,
        reason,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  /**
   * Confirms a new order to the customer, with its lines and total, and its
   * tax invoice attached when it could be issued.
   */
  async send_order_confirmation(
    order: NewOrderCustomerJobData,
    invoice?: { filename: string; content: Buffer },
  ): Promise<{ messageId?: string }> {
    const resolvedLang = order.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';

    return this.sendMail({
      to: order.email,
      subject: order.subject,
      template: `new-order-customer-${resolvedLang}`,
      attachments: invoice
        ? [
            {
              filename: invoice.filename,
              content: invoice.content,
              contentType: 'application/pdf',
            },
          ]
        : undefined,
      context: {
        hasInvoice: !!invoice,
        subject: order.subject,
        name: order.name,
        orderId: order.orderId,
        orderDate: order.date,
        orderTotal: order.amount,
        currency: order.currency,
        products: order.orderDetails,
        orderUrl: order.orderUrl,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  /** Confirms a received payment, with the tax invoice attached when issued. */
  async send_payment_received(
    payment: PaymentReceivedJobData,
    invoice?: { filename: string; content: Buffer },
  ): Promise<{ messageId?: string }> {
    const resolvedLang = payment.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';

    return this.sendMail({
      to: payment.email,
      subject: payment.subject,
      template: `payment-received-customer-${resolvedLang}`,
      attachments: invoice
        ? [
            {
              filename: invoice.filename,
              content: invoice.content,
              contentType: 'application/pdf',
            },
          ]
        : undefined,
      context: {
        hasInvoice: !!invoice,
        subject: payment.subject,
        name: payment.name,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        orderUrl: payment.orderUrl,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  /** Sends the customer a tax credit note, its PDF attached when issued. */
  async send_credit_note(
    note: CreditNoteCustomerJobData,
    pdf?: { filename: string; content: Buffer },
  ): Promise<{ messageId?: string }> {
    const resolvedLang = note.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';

    return this.sendMail({
      to: note.email,
      subject: note.subject,
      template: `credit-note-customer-${resolvedLang}`,
      attachments: pdf
        ? [
            {
              filename: pdf.filename,
              content: pdf.content,
              contentType: 'application/pdf',
            },
          ]
        : undefined,
      context: {
        hasPdf: !!pdf,
        subject: note.subject,
        name: note.name,
        creditNoteNumber: note.creditNoteNumber,
        orderNumber: note.orderNumber,
        total: note.total,
        // Strict templates: always defined
        refundAmount: note.refundAmount ?? '',
        refundVia: note.refundVia ?? 'none',
        returnShipping: note.returnShipping ?? '',
        deductionNote: note.deductionNote ?? '',
        currency: note.currency,
        orderUrl: note.orderUrl,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  /**
   * Tells the customer about a refund made in the Moyasar dashboard (full or
   * partial, and whether it cancelled the order).
   */
  /** Tells the customer their return request was not accepted, and why. */
  async send_return_request_rejected(data: {
    email: string;
    name: string;
    orderNumber: string;
    rejectionReason: string;
    orderUrl: string;
    subject: string;
    lang?: string;
  }): Promise<void> {
    const resolvedLang = data.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';

    await this.sendMail({
      to: data.email,
      subject: data.subject,
      template: `return-request-rejected-customer-${resolvedLang}`,
      context: {
        subject: data.subject,
        name: data.name,
        orderNumber: data.orderNumber,
        rejectionReason: data.rejectionReason,
        orderUrl: data.orderUrl,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  async send_order_refunded(refund: {
    email: string;
    orderId: string;
    invoiceNumber?: string;
    refundedAmount: string;
    currency: string;
    isFull: boolean;
    cancelled: boolean;
    orderUrl: string;
    subject: string;
    lang?: string;
  }): Promise<void> {
    const resolvedLang = refund.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';

    await this.sendMail({
      to: refund.email,
      subject: refund.subject,
      template: `order-refunded-${resolvedLang}`,
      context: {
        subject: refund.subject,
        invoiceNumber: refund.invoiceNumber ?? refund.orderId,
        refundedAmount: refund.refundedAmount,
        currency: refund.currency,
        isFull: refund.isFull,
        cancelled: refund.cancelled,
        orderUrl: refund.orderUrl,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  /**
   * Alerts the admin that a database backup failed after all retries.
   * `reason` must already be sanitized (no credentials or URIs).
   */
  async send_backup_failure_alert(alert: BackupFailedJobData): Promise<void> {
    const resolvedLang = alert.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';

    await this.sendMail({
      to: alert.email,
      subject: alert.subject,
      template: `backup-failure-alert-${resolvedLang}`,
      context: {
        subject: alert.subject,
        adminName: process.env.SUPER_ADMIN_NAME || 'Admin',
        jobId: alert.jobId,
        trigger: alert.trigger,
        attemptsMade: alert.attemptsMade,
        failedAt: alert.failedAt,
        reason: alert.reason,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }

  /**
   * Notifies the admin that a mail job has permanently failed
   * (i.e. exhausted all of its retry attempts).
   */
  async send_job_failure_alert(
    jobName: string,
    jobId: string | undefined,
    errorMessage: string,
    attemptsMade: number,
    lang?: string,
  ): Promise<void> {
    const resolvedLang =
      lang ??
      I18nContext.current()?.lang ??
      process.env.DEFAULT_LANGUAGE ??
      'ar';
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminName = process.env.SUPER_ADMIN_NAME || 'Super Admin';
    const template = `job-failure-alert-${resolvedLang}`;
    const subject =
      resolvedLang === 'ar'
        ? `🚨 فشل تنفيذ مهمة بريد: ${jobName}`
        : `🚨 Mail job failed: ${jobName}`;
    console.log(
      `📧 Attempting to send [send_job_failure_alert] to Admin: ${adminEmail} | Lang: ${resolvedLang} | Template: ${template}`,
    );

    await this.sendMail({
      to: adminEmail,
      subject,
      template,
      context: {
        subject,
        adminName,
        jobName,
        jobId: jobId ?? 'N/A',
        errorMessage,
        attemptsMade,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }
}
