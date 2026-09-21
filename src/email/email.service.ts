import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}
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

    await this.mailerService.sendMail({
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

    await this.mailerService.sendMail({
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
        quantity: string;
        imageCover: string;
      };
      quantity: string;
      totalPrice: string;
    }[],

    subject: string,
    lang?: string,
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

    await this.mailerService.sendMail({
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
        currency: 'ل.س',
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

    await this.mailerService.sendMail({
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

    await this.mailerService.sendMail({
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

    await this.mailerService.sendMail({
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

    await this.mailerService.sendMail({
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

    await this.mailerService.sendMail({
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

    await this.mailerService.sendMail({
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

    await this.mailerService.sendMail({
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
