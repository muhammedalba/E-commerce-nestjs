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
    const resolvedLang = lang ?? I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    const template = `verify-code-${resolvedLang}`;
    console.log(`📧 Attempting to send [sendRandomCode] to: ${to} | Lang: ${resolvedLang} | Template: ${template}`);
    
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
    const resolvedLang = lang ?? I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    const template = `reset-pass-${resolvedLang}`;
    console.log(`📧 Attempting to send [send_reset_password_success] to: ${to} | Lang: ${resolvedLang} | Template: ${template}`);

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
    const resolvedLang = lang ?? I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    const adminEmail = process.env.ADMIN_EMAIL;
    const template = `new-admin-order-${resolvedLang}`;
    console.log(`📧 Attempting to send [new_admin_order] to Admin: ${adminEmail} | Lang: ${resolvedLang} | Template: ${template}`);

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
}
