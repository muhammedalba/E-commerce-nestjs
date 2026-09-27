import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpException,
  Logger,
} from '@nestjs/common';
import { PaymentTransactionService } from './payment-transaction.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { WebhookMoyasarDto } from './shared/dto/webhook-moyasar.dto';
import { PaymentProviderFactory } from './providers/payment-provider.factory';

@Controller('payments')
export class PaymentTransactionsController {
  private readonly logger = new Logger(PaymentTransactionsController.name);

  constructor(
    private readonly paymentTransactionService: PaymentTransactionService,
    private readonly providerFactory: PaymentProviderFactory,
  ) {}

  /* ================================================ */
  /*  MOYASAR WEBHOOK                                  */
  /* ================================================ */
  @Post('webhooks/moyasar')
  async handleMoyasarWebhook(@Body() payload: WebhookMoyasarDto) {
    const paymentId = await this.providerFactory
      .getMoyasarProvider()
      .verifyWebhook(payload);

    if (paymentId) {
      // Securely process by triggering verifyPaymentStatus which fetches the real payment from Moyasar
      try {
        await this.paymentTransactionService.verifyPaymentStatus(paymentId);
      } catch (error) {
        // 4xx is permanent (unknown payment, payout event, bad metadata):
        // acknowledge so Moyasar stops retrying.
        if (error instanceof HttpException && error.getStatus() < 500) {
          this.logger.warn(
            `Webhook for payment ${paymentId} not processed: ${error.message}`,
          );
        } else {
          // Transient (provider or DB unavailable): fail so Moyasar redelivers.
          // Safe to repeat: status transitions are atomic and emit at most once.
          this.logger.error(
            `Webhook for payment ${paymentId} failed, Moyasar will retry: ${(error as Error).message}`,
          );
          throw error;
        }
      }
    }
    return { received: true };
  }

  /* ================================================ */
  /*  VERIFY PAYMENT STATUS (Frontend Polling)         */
  /* ================================================ */
  @Get('verify/:invoiceId')
  verifyPaymentStatus(@Param('invoiceId') invoiceId: string) {
    return this.paymentTransactionService.verifyPaymentStatus(invoiceId);
  }

  /* ================================================ */
  /*  RETRY PAYMENT                                    */
  /* ================================================ */
  @Post('retry/:orderId')
  @UseGuards(AuthGuard)
  retryPayment(
    @Param('orderId') orderId: string,
    @Request() req: { user: { _id: string; email: string } },
  ) {
    const userId = String(req.user._id);
    const userEmail = String(req.user.email);
    return this.paymentTransactionService.retryPayment(
      orderId,
      userId,
      userEmail,
    );
  }
}
