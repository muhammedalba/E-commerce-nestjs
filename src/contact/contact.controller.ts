import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { CreateContactDto } from './shared/dto/create-contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ------------ =============================== ---------- //
  // ------------ ======  SEND CONTACT MESSAGE   ====== ---------- //
  // ------------ =============================== ---------- //
  @Post()
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 messages per minute (anti-spam)
  async create(@Body() createContactDto: CreateContactDto): Promise<any> {
    return await this.contactService.submitMessage(createContactDto);
  }
}
