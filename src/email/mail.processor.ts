import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmailService } from './email.service';
import { NotificationsService } from 'src/notifications/notifications.service';

@Processor('mail-queue')
export class MailProcessor extends WorkerHost {
  constructor(
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.error(
      `❌ failed job with name: [${job.name}] (ID: ${job.id}). with error: ${error.message}`,
    );
    // يمكنك هنا لاحقاً كتابة كود لحفظ الخطأ في قاعدة البيانات أو إرسال تنبيه للإدارة
  }

  async process(job: Job<any, any, string>): Promise<any> {
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
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
