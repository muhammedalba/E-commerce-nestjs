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
  ): Promise<void> {
    const lang = I18nContext.current()?.lang ?? process.env.DEFAULT_LANG;
    await this.mailerService.sendMail({
      to,
      template: `verify-code-${lang}`,
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
  ): Promise<void> {
    const lang = I18nContext.current()?.lang ?? process.env.DEFAULT_LANG;

    await this.mailerService.sendMail({
      to,
      subject,
      template: `reset-pass-${lang}`,
      context: {
        name,
        supportLink,
        loginLink,
        year: new Date().getFullYear(),
        companyName: process.env.APP_NAME,
      },
    });
  }
}
