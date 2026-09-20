import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  imports: [
    // Reuses the queue already registered by EmailModule so contact
    // messages are delivered asynchronously with the same retry/backoff.
    BullModule.registerQueue({ name: 'mail-queue' }),
  ],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
