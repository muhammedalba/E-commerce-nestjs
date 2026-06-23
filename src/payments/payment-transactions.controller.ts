import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PaymentTransactionService } from './payment-transaction.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { WebhookMoyasarDto } from './shared/dto/webhook-moyasar.dto';
import { PaymentProviderFactory } from './providers/payment-provider.factory';

@Controller('payments')
export class PaymentTransactionsController {
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
        // Log but don't fail, we return 200 OK to Moyasar
        console.error('Webhook verification failed:', error);
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
