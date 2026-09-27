import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  RecaptchaGuard,
  RecaptchaUnverified,
} from 'src/shared/guards/recaptcha.guard';
import { QuoteRequestsService } from './quote-requests.service';
import { CreateQuoteRequestDto } from './shared/dto/create-quote-request.dto';

@Controller('quote-requests')
export class QuoteRequestsController {
  constructor(private readonly quoteRequestsService: QuoteRequestsService) {}

  // ------------ =============================== ---------- //
  // ------------ ======  SUBMIT QUOTE REQUEST   ====== ---------- //
  // ------------ =============================== ---------- //
  @Post()
  @UseGuards(new RecaptchaGuard('quote_request'))
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 requests per minute (anti-spam)
  async create(
    @Body() dto: CreateQuoteRequestDto,
    @RecaptchaUnverified() recaptchaUnverified: boolean,
  ): Promise<any> {
    return await this.quoteRequestsService.submitRequest(
      dto,
      recaptchaUnverified,
    );
  }
}
