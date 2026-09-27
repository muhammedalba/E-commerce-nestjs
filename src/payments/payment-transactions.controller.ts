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
import {
  LinkMoyasarPaymentDto,
  VerifyPaymentParamDto,
} from './shared/dto/link-moyasar-payment.dto';
import { Throttle } from '@nestjs/throttler';
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
  // Public and each call hits the Moyasar API: bounded per client. The
  // callback page polls every 3s (20/min), so 30 leaves room for retries.
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  verifyPaymentStatus(@Param() params: VerifyPaymentParamDto) {
    return this.paymentTransactionService.verifyPaymentStatus(params.invoiceId);
  }

  /* ================================================ */
  /*  LINK MOYASAR PAYMENT (checkout page, pre-3DS)    */
  /* ================================================ */
  @Post('moyasar/link')
  @UseGuards(AuthGuard)
  linkMoyasarPayment(
    @Body() { paymentId }: LinkMoyasarPaymentDto,
    @Request() req: { user: { _id: string } },
  ) {
    return this.paymentTransactionService.linkMoyasarPayment(
      paymentId,
      String(req.user._id),
    );
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
