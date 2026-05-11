import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { CheckoutService, CheckoutPreviewDto } from './checkout.service';
import { AuthGuard } from '../auth/shared/guards/auth.guard';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('preview')
  @UseGuards(AuthGuard)
  async preview(@Body() dto: CheckoutPreviewDto, @Req() req: any) {
    return this.checkoutService.getCheckoutPreview(dto, req.user.user_id);
  }
}
