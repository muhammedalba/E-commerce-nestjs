import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { QuoteRequestsService } from './quote-requests.service';
import { CreateQuoteRequestDto } from './shared/dto/create-quote-request.dto';

@Controller('quote-requests')
export class QuoteRequestsController {
  constructor(private readonly quoteRequestsService: QuoteRequestsService) {}

  // ------------ =============================== ---------- //
  // ------------ ======  SUBMIT QUOTE REQUEST   ====== ---------- //
  // ------------ =============================== ---------- //
  @Post()
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 requests per minute (anti-spam)
  async create(@Body() dto: CreateQuoteRequestDto): Promise<any> {
    return await this.quoteRequestsService.submitRequest(dto);
  }
}
