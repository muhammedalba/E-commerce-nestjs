import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QuoteRequestsController } from './quote-requests.controller';
import { QuoteRequestsService } from './quote-requests.service';

@Module({
  imports: [
    // Reuses the queue already registered by EmailModule so quote requests
    // are delivered asynchronously with the same retry/backoff.
    BullModule.registerQueue({ name: 'mail-queue' }),
  ],
  controllers: [QuoteRequestsController],
  providers: [QuoteRequestsService],
})
export class QuoteRequestsModule {}
