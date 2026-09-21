import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmailService } from './email.service';
import { NotificationsService } from 'src/notifications/notifications.service';

interface SendResetSuccessJobData {
  email: string;
  name: string;
  supportLink: string;
  loginLink: string;
  message: string;
  lang?: string;
}

interface SendRandomCodeJobData {
  email: string;
  name: string;
  code: string;
  subject: string;
  lang?: string;
}

interface NewAdminOrderProduct {
  product: {
    id: string;
    title: string;
    price: string;
    quantity: string;
    imageCover: string;
  };
  quantity: string;
  totalPrice: string;
}

interface NewAdminOrderJobData {
  appName: string;
  email: string;
  date: string;
  amount: string;
  url: string;
  orderId: string;
  orderDetails: NewAdminOrderProduct[];
  subject: string;
  lang?: string;
}

interface InventoryAlertJobData {
  email: string;
  adminName: string;
  productTitle: string;
  sku: string;
  stock: number;
  threshold: number;
  alertType: string;
  subject: string;
  lang?: string;
}

interface ContactMessageJobData {
  name: string;
  email: string;
  phone: string;
  inquiryTypeLabel: string;
  message: string;
  adminSubject: string;
  confirmationSubject: string;
  lang?: string;
}

interface QuoteRequestJobData {
  customerTypeLabel: string;
  name: string;
  phone: string;
  emails: string[];
  preferredContactMethodLabel: string;
  orderDetails: string;
  deliveryAddress: string;
  commercialRegistrationNumber?: string;
  taxNumber?: string;
  nationalAddress?: string;
  adminSubject: string;
  confirmationSubject: string;
  lang?: string;
}

interface ExchangeRateSyncFailedJobData {
  email: string;
  adminName: string;
  currencyCode: string;
  consecutiveFailures: number;
  reason: string;
  subject: string;
  lang?: string;
}

interface AdminRoleNotificationJobData {
  roleId: string;
  action: string;
  message: string | { ar: string; en: string };
  payload?: unknown;
}

type MailJob =
  | Job<SendResetSuccessJobData, MailJobResult, 'send-reset-success'>
  | Job<SendRandomCodeJobData, MailJobResult, 'send-random-code'>
  | Job<NewAdminOrderJobData, MailJobResult, 'new-admin-order'>
  | Job<InventoryAlertJobData, MailJobResult, 'inventory-alert'>
  | Job<ContactMessageJobData, MailJobResult, 'contact-message'>
  | Job<QuoteRequestJobData, MailJobResult, 'quote-request'>
  | Job<
      ExchangeRateSyncFailedJobData,
      MailJobResult,
      'exchange-rate-sync-failed'
    >
  | Job<AdminRoleNotificationJobData, MailJobResult, 'admin-role-notification'>;

type MailJobResult = Record<string, never>;

@Processor('mail-queue')
export class MailProcessor extends WorkerHost {
  constructor(
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  @OnWorkerEvent('failed')
  async onFailed(job: MailJob, error: Error) {
    console.error(
      `❌ failed job with name: [${job.name}] (ID: ${job.id}). with error: ${error.message}`,
    );

    const maxAttempts = job.opts.attempts ?? 1;
    const hasExhaustedRetries = job.attemptsMade >= maxAttempts;
    if (!hasExhaustedRetries) {
      return;
    }

    try {
      await this.emailService.send_job_failure_alert(
        job.name,
        job.id,
        error.message,
        job.attemptsMade,
      );
    } catch (notificationError) {
      const notificationErrorMessage =
        notificationError instanceof Error
          ? notificationError.message
          : String(notificationError);
      console.error(
        `❌ failed to send admin alert for failed job [${job.name}] (ID: ${job.id}): ${notificationErrorMessage}`,
      );
    }
  }

  async process(job: MailJob): Promise<MailJobResult> {
    const jobName = job.name;
    switch (job.name) {
      case 'send-reset-success': {
        const { email, name, supportLink, loginLink, message, lang } = job.data;
        await this.emailService.send_reset_password_success(
          email,
          name,
          supportLink,
          loginLink,
          message,
          lang,
        );
        return {};
      }
      case 'send-random-code': {
        const { email, name, code, subject, lang } = job.data;
        await this.emailService.sendRandomCode(
          email,
          name,
          code,
          subject,
          lang,
        );
        return {};
      }
      case 'new-admin-order': {
        const {
          appName,
          email,
          date,
          amount,
          url,
          orderId,
          orderDetails,
          subject,
          lang,
        } = job.data;
        await this.emailService.new_admin_order(
          appName,
          email,
          date,
          amount,
          url,
          orderId,
          orderDetails,
          subject,
          lang,
        );
        return {};
      }
      case 'inventory-alert': {
        const {
          email,
          adminName,
          productTitle,
          sku,
          stock,
          threshold,
          alertType,
          subject,
          lang,
        } = job.data;
        await this.emailService.send_inventory_alert(
          email,
          adminName,
          productTitle,
          sku,
          stock,
          threshold,
          alertType,
          subject,
          lang,
        );
        return {};
      }
      case 'contact-message': {
        const {
          name,
          email,
          phone,
          inquiryTypeLabel,
          message,
          adminSubject,
          confirmationSubject,
          lang,
        } = job.data;
        await this.emailService.send_contact_admin_notification(
          name,
          email,
          phone,
          inquiryTypeLabel,
          message,
          adminSubject,
          lang,
        );
        await this.emailService.send_contact_confirmation(
          email,
          name,
          confirmationSubject,
          lang,
        );
        return {};
      }
      case 'quote-request': {
        const {
          customerTypeLabel,
          name,
          phone,
          emails,
          preferredContactMethodLabel,
          orderDetails,
          deliveryAddress,
          commercialRegistrationNumber,
          taxNumber,
          nationalAddress,
          adminSubject,
          confirmationSubject,
          lang,
        } = job.data;
        await this.emailService.send_quote_request_admin_notification(
          customerTypeLabel,
          name,
          phone,
          emails,
          preferredContactMethodLabel,
          orderDetails,
          deliveryAddress,
          commercialRegistrationNumber,
          taxNumber,
          nationalAddress,
          adminSubject,
          lang,
        );
        await this.emailService.send_quote_request_confirmation(
          emails,
          name,
          confirmationSubject,
          lang,
        );
        return {};
      }
      case 'exchange-rate-sync-failed': {
        const {
          email,
          adminName,
          currencyCode,
          consecutiveFailures,
          reason,
          subject,
          lang,
        } = job.data;
        await this.emailService.send_exchange_rate_alert(
          email,
          adminName,
          currencyCode,
          consecutiveFailures,
          reason,
          subject,
          lang,
        );
        return {};
      }
      case 'admin-role-notification': {
        const { roleId, action, message, payload } = job.data;
        await this.notificationsService.createRoleNotification({
          roleId,
          action,
          message,
          payload,
        });
        return {};
      }
      default:
        throw new Error(`Unknown job name: ${jobName}`);
    }
  }
}
