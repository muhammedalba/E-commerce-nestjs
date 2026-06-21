import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  Request,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { PaymentsService } from './payments.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';
import { CreatePaymentMethodDto } from './shared/dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './shared/dto/update-payment-method.dto';
import { WebhookMoyasarDto } from './shared/dto/webhook-moyasar.dto';
import { decryptConfigValues } from './shared/schema/payment-method.schema';

@Controller('payments')
@UseInterceptors(ClearCacheInterceptor)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {}

  /* ================================================ */
  /*  MOYASAR WEBHOOK                                  */
  /* ================================================ */
  @Post('webhooks/moyasar')
  async handleMoyasarWebhook(@Body() payload: WebhookMoyasarDto) {
    const moyasarMethod = await this.paymentsService.findByCode('moyasar');
    const decryptedConfig = moyasarMethod?.config
      ? (decryptConfigValues(moyasarMethod.config) as Record<string, string>)
      : {};
    const secret =
      decryptedConfig.MOYASAR_WEBHOOK_SECRET ||
      process.env.MOYASAR_WEBHOOK_SECRET;
    if (secret && payload.secret_token !== secret) {
      throw new UnauthorizedException('Invalid Webhook Secret Token');
    }

    // A Moyasar Webhook payload contains the payment object inside `data`
    const paymentId = payload?.data?.id as string | undefined;
    if (paymentId) {
      // Securely process by triggering verifyPaymentStatus which fetches the real payment from Moyasar
      // This guarantees we can't be spoofed by a fake webhook request.
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

  /* ================================================ */
  /*  GET ACTIVE METHODS - Public (للـ Checkout)       */
  /* ================================================ */
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(3600000)
  getActiveMethods(
    @Query('currency') currency?: string,
    @Query('countryId') countryId?: string,
  ) {
    return this.paymentsService.getActiveMethods({ currency, countryId });
  }

  /* ================================================ */
  /*  ADMIN: GET ALL (including inactive)              */
  /* ================================================ */
  @Get('all')
  @RequirePermission(Permissions.VIEW_PAYMENT_METHODS)
  @UseGuards(AuthGuard, PermissionsGuard)
  findAll(@Query() queryString: QueryString) {
    return this.paymentsService.findAll(queryString);
  }

  /* ================================================ */
  /*  ADMIN: GET ONE                                   */
  /* ================================================ */
  @Get(':id')
  @RequirePermission(Permissions.VIEW_PAYMENT_METHODS)
  @UseGuards(AuthGuard, PermissionsGuard)
  findOne(@Param() { id }: IdParamDto) {
    return this.paymentsService.findById(id);
  }

  /* ================================================ */
  /*  CREATE - Admin Only                              */
  /* ================================================ */
  @Post()
  @RequirePermission(Permissions.CREATE_PAYMENT_METHOD)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('payments')
  create(@Body() body: CreatePaymentMethodDto) {
    return this.paymentsService.create(body);
  }

  /* ================================================ */
  /*  UPDATE - Admin Only                              */
  /* ================================================ */
  @Patch(':id')
  @RequirePermission(Permissions.UPDATE_PAYMENT_METHOD)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('payments')
  update(@Param() { id }: IdParamDto, @Body() body: UpdatePaymentMethodDto) {
    return this.paymentsService.update(id, body);
  }

  /* ================================================ */
  /*  DELETE - Admin Only                              */
  /* ================================================ */
  @Delete(':id')
  @RequirePermission(Permissions.DELETE_PAYMENT_METHOD)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('payments')
  remove(@Param() { id }: IdParamDto) {
    return this.paymentsService.remove(id);
  }
}
