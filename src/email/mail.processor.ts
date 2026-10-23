import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { DelayedError, Job } from 'bullmq';
import { EmailService } from './email.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { InvoiceService } from 'src/invoice/invoice.service';
import { CreditNoteService } from 'src/invoice/credit-note.service';

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
  /** Store currency symbol/code; absent on jobs queued before it was added. */
  currency?: string;
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

/** Jobs that attach a PDF (invoice, credit note) another worker may be issuing. */
interface PdfJobData {
  /** Times the job waited for that worker's generation lease (no attempt used). */
  pdfWaits?: number;
}

export interface NewOrderCustomerJobData extends PdfJobData {
  email: string;
  name: string;
  orderId: string;
  date: string;
  amount: string;
  currency: string;
  orderDetails: NewAdminOrderProduct[];
  orderUrl: string;
  subject: string;
  lang?: string;
  /** The order's _id, to issue and attach its invoice; absent on older jobs. */
  orderMongoId?: string;
}

export interface PaymentReceivedJobData extends PdfJobData {
  email: string;
  name: string;
  orderId: string;
  amount: string;
  currency: string;
  orderUrl: string;
  subject: string;
  lang?: string;
  /** The order's _id: its invoice is issued and attached. */
  orderMongoId: string;
  /** The dashboard resent it: sent even if the invoice went out before. */
  resend?: boolean;
}

export interface CreditNoteCustomerJobData extends PdfJobData {
  email: string;
  name: string;
  creditNoteId: string;
  creditNoteNumber: string;
  orderNumber: string;
  total: string;
  /** The refund it settles ('' when none); absent on jobs queued before. */
  refundAmount?: string;
  /** moyasar | manual | already_refunded | none */
  refundVia?: string;
  /** Return shipping kept back from the refund ('' when none). */
  returnShipping?: string;
  /** That deduction and its reason in words, in the email's language. */
  deductionNote?: string;
  currency: string;
  orderUrl: string;
  subject: string;
  lang?: string;
}

/** A customer's return request was rejected (OrderReturnRequestService). */
interface ReturnRejectedJobData {
  email: string;
  name: string;
  orderNumber: string;
  rejectionReason: string;
  orderUrl: string;
  subject: string;
  lang?: string;
}

interface OrderRefundedJobData {
  email: string;
  orderId: string;
  /** Order number shown in the email; absent on jobs queued before it. */
  invoiceNumber?: string;
  refundedAmount: string;
  currency: string;
  isFull: boolean;
  /** The refund cancelled the order (full refund before shipping). */
  cancelled: boolean;
  orderUrl: string;
  subject: string;
  lang?: string;
}

export interface BackupFailedJobData {
  email: string;
  jobId: string;
  trigger: string;
  attemptsMade: number;
  failedAt: string;
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
  | Job<NewOrderCustomerJobData, MailJobResult, 'new-order-customer'>
  | Job<OrderRefundedJobData, MailJobResult, 'order-refunded'>
  | Job<
      ReturnRejectedJobData,
      MailJobResult,
      'return-request-rejected-customer'
    >
  | Job<CreditNoteCustomerJobData, MailJobResult, 'credit-note-customer'>
  | Job<PaymentReceivedJobData, MailJobResult, 'payment-received-customer'>
  | Job<BackupFailedJobData, MailJobResult, 'backup-failed'>
  | Job<AdminRoleNotificationJobData, MailJobResult, 'admin-role-notification'>;

type MailJobResult = Record<string, never>;

/** What pdfAttachment needs of a job: its attempts, data and delay. */
type PdfJob = Pick<
  Job,
  'id' | 'attemptsMade' | 'opts' | 'moveToDelayed' | 'updateData'
> & { data: PdfJobData };

/** Wait between checks while another worker issues the PDF. */
const PDF_BUSY_DELAY_MS = 15_000;
/** 2.5 min: outlasts the issuer's 2-minute lease, so a stale one is taken over. */
const MAX_PDF_BUSY_WAITS = 10;

@Processor('mail-queue')
export class MailProcessor extends WorkerHost {
  constructor(
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly invoiceService: InvoiceService,
    private readonly creditNoteService: CreditNoteService,
  ) {
    super();
  }

  /**
   * The order's tax invoice to attach: issued and stored first (or the stored
   * one on a retry, never a second one). While retries remain a failure fails
   * the job; on the last attempt the confirmation goes out without it.
   */
  private async invoiceAttachment(
    job: Job<NewOrderCustomerJobData, MailJobResult, 'new-order-customer'>,
    token?: string,
  ): Promise<{ filename: string; content: Buffer } | undefined> {
    const { orderMongoId } = job.data;
    if (!orderMongoId) return undefined;
    return this.pdfAttachment(
      job,
      `invoice for order ${orderMongoId}`,
      () => this.invoiceService.generateAndStore(orderMongoId),
      token,
    );
  }

  /**
   * A document PDF to attach (invoice, credit note): stored first, or the
   * stored one on a retry. While another worker is issuing it the job waits
   * without using an attempt (see {@link waitForPdf}). Otherwise, while
   * retries remain a failure fails the job; on the last attempt the email
   * goes out without it (admin can regenerate).
   */
  private async pdfAttachment(
    job: PdfJob,
    label: string,
    issue: () => Promise<{ filename: string; buffer: Buffer }>,
    token?: string,
  ): Promise<{ filename: string; content: Buffer } | undefined> {
    try {
      const pdf = await issue();
      return { filename: pdf.filename, content: pdf.buffer };
    } catch (error) {
      if (
        (error as Error).name?.endsWith('BusyError') &&
        (await this.waitForPdf(job, label, token))
      ) {
        throw new DelayedError();
      }
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (!isLastAttempt) throw error;
      console.warn(
        `⚠️ ${label} could not be issued after ${job.attemptsMade + 1} attempts; sending the email without it (admin can regenerate): ${(error as Error).message}`,
      );
      return undefined;
    }
  }

  /**
   * Postpones the job by PDF_BUSY_DELAY_MS without using one of its attempts
   * (BullMQ DelayedError): the worker holding the generation lease finishes,
   * or its lease expires and this job takes over. False once it has waited
   * MAX_PDF_BUSY_WAITS times, or when the worker token is unknown.
   */
  private async waitForPdf(
    job: PdfJob,
    label: string,
    token?: string,
  ): Promise<boolean> {
    const waits = job.data.pdfWaits ?? 0;
    if (!token || waits >= MAX_PDF_BUSY_WAITS) return false;
    await job.updateData({ ...job.data, pdfWaits: waits + 1 });
    await job.moveToDelayed(Date.now() + PDF_BUSY_DELAY_MS, token);
    console.log(
      `⏳ ${label} is being issued by another worker; job ${job.id} waits ${PDF_BUSY_DELAY_MS / 1000}s (${waits + 1}/${MAX_PDF_BUSY_WAITS})`,
    );
    return true;
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

  async process(job: MailJob, token?: string): Promise<MailJobResult> {
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
          currency,
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
          currency,
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
      case 'new-order-customer': {
        const invoice = await this.invoiceAttachment(job, token);
        const sent = await this.emailService.send_order_confirmation(
          job.data,
          invoice,
        );
        if (job.data.orderMongoId) {
          // Never fail the job here: that would email the customer twice
          await this.invoiceService
            .recordCustomerEmail(
              job.data.orderMongoId,
              !!invoice,
              sent?.messageId,
            )
            .catch((err: Error) =>
              console.warn(
                `⚠️ could not record the confirmation email of order ${job.data.orderMongoId}: ${err.message}`,
              ),
            );
        }
        return {};
      }
      case 'payment-received-customer': {
        const { orderMongoId } = job.data;
        // Once: a Moyasar order got it with its confirmation, and a second
        // "paid" click must not email it again (unless resent on purpose)
        if (
          !job.data.resend &&
          (await this.invoiceService.wasEmailed(orderMongoId))
        ) {
          return {};
        }
        const invoice = await this.pdfAttachment(
          job,
          `invoice for order ${orderMongoId}`,
          () => this.invoiceService.generateAndStore(orderMongoId),
          token,
        );
        const sent = await this.emailService.send_payment_received(
          job.data,
          invoice,
        );
        // Never fail the job here: that would email the customer twice
        await this.invoiceService
          .recordCustomerEmail(orderMongoId, !!invoice, sent?.messageId)
          .catch((err: Error) =>
            console.warn(
              `⚠️ could not record the payment email of order ${orderMongoId}: ${err.message}`,
            ),
          );
        return {};
      }
      case 'credit-note-customer': {
        const { creditNoteId } = job.data;
        const pdf = await this.pdfAttachment(
          job,
          `credit note ${creditNoteId}`,
          () => this.creditNoteService.generateAndStore(creditNoteId),
          token,
        );
        const sent = await this.emailService.send_credit_note(job.data, pdf);
        // Never fail the job here: that would email the customer twice
        await this.creditNoteService
          .recordCustomerEmail(creditNoteId, !!pdf, sent?.messageId)
          .catch((err: Error) =>
            console.warn(
              `⚠️ could not record the email of credit note ${creditNoteId}: ${err.message}`,
            ),
          );
        return {};
      }
      case 'return-request-rejected-customer': {
        await this.emailService.send_return_request_rejected(job.data);
        return {};
      }
      case 'order-refunded': {
        await this.emailService.send_order_refunded(job.data);
        return {};
      }
      case 'backup-failed': {
        await this.emailService.send_backup_failure_alert(job.data);
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
