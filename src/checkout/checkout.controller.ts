import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CheckoutOrchestratorService } from './checkout-orchestrator.service';
import { AuthGuard } from '../auth/shared/guards/auth.guard';
import { FileUploadService } from '../file-upload/file-upload.service';
import { createParseFilePipe } from '../shared/files/files-validation-factory';

@Controller('checkout')
@UseGuards(AuthGuard)
export class CheckoutController {
  constructor(
    private readonly orchestrator: CheckoutOrchestratorService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Get('summary')
  async getSummary(@Req() req: { user: { user_id: string } }) {
    return this.orchestrator.getSummary(req.user.user_id);
  }

  @Post('address')
  async setAddress(
    @Body('address')
    address: { cityId?: string; [key: string]: unknown } | string,
    @Req() req: { user: { user_id: string } },
  ) {
    return this.orchestrator.setAddress(req.user.user_id, address);
  }

  @Post('shipping-method')
  async setShippingMethod(
    @Body('shippingProviderId') shippingProviderId: string,
    @Req() req: { user: { user_id: string } },
  ) {
    return this.orchestrator.setShippingMethod(
      req.user.user_id,
      shippingProviderId,
    );
  }

  @Post('payment-method')
  async setPaymentMethod(
    @Body('paymentMethodId') paymentMethodId: string,
    @Req() req: { user: { user_id: string } },
  ) {
    return this.orchestrator.setPaymentMethod(
      req.user.user_id,
      paymentMethodId,
    );
  }

  @Post('coupon')
  async applyCoupon(
    @Body('couponCode') couponCode: string,
    @Req() req: { user: { user_id: string } },
  ) {
    return this.orchestrator.applyCoupon(req.user.user_id, couponCode);
  }

  @Post('place-order')
  @UseInterceptors(FileInterceptor('transferReceiptImg'))
  async placeOrder(
    @Body('notes') notes: string,
    @Req() req: { user: { user_id: string; email: string } },
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file?: Express.Multer.File,
  ) {
    let transferReceiptImg: string | undefined;
    if (file) {
      transferReceiptImg = await this.fileUploadService.saveFileToDisk(
        file,
        'orders',
      );
    }
    return this.orchestrator.placeOrder(
      req.user.user_id,
      req.user.email,
      notes,
      transferReceiptImg,
    );
  }
}
