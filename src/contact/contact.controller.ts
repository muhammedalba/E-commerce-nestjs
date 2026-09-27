import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  RecaptchaGuard,
  RecaptchaUnverified,
} from 'src/shared/guards/recaptcha.guard';
import { ContactService } from './contact.service';
import { CreateContactDto } from './shared/dto/create-contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ------------ =============================== ---------- //
  // ------------ ======  SEND CONTACT MESSAGE   ====== ---------- //
  // ------------ =============================== ---------- //
  @Post()
  @UseGuards(new RecaptchaGuard('contact'))
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 messages per minute (anti-spam)
  async create(
    @Body() createContactDto: CreateContactDto,
    @RecaptchaUnverified() recaptchaUnverified: boolean,
  ): Promise<any> {
    return await this.contactService.submitMessage(
      createContactDto,
      recaptchaUnverified,
    );
  }
}
