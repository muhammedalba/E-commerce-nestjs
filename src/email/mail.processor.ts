import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmailService } from './email.service';

@Processor('mail-queue')
export class MailProcessor extends WorkerHost {
  constructor(private readonly emailService: EmailService) {
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
        await this.emailService.sendRandomCode(email, name, code, subject, lang);
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
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
