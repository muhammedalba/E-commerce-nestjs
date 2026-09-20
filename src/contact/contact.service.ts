import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { CreateContactDto } from './shared/dto/create-contact.dto';
import { ContactInquiryType } from './shared/enums/inquiry-type.enum';

const INQUIRY_TYPE_LABEL_KEYS: Record<ContactInquiryType, string> = {
  [ContactInquiryType.GENERAL]: 'email.CONTACT_INQUIRY_GENERAL',
  [ContactInquiryType.PRODUCT]: 'email.CONTACT_INQUIRY_PRODUCT',
  [ContactInquiryType.SERVICE_QUOTE]: 'email.CONTACT_INQUIRY_SERVICE_QUOTE',
  [ContactInquiryType.COMPLAINT]: 'email.CONTACT_INQUIRY_COMPLAINT',
};

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
    private readonly i18n: I18nService,
  ) {}

  async submitMessage(createContactDto: CreateContactDto) {
    const lang =
      I18nContext.current()?.lang || process.env.DEFAULT_LANGUAGE || 'ar';

    try {
      await this.mailQueue.add('contact-message', {
        name: createContactDto.name,
        email: createContactDto.email,
        phone: createContactDto.phone,
        message: createContactDto.message,
        inquiryTypeLabel: this.i18n.translate(
          INQUIRY_TYPE_LABEL_KEYS[createContactDto.inquiryType],
          { lang },
        ),
        adminSubject: this.i18n.translate('email.CONTACT_ADMIN_SUBJECT', {
          lang,
        }),
        confirmationSubject: this.i18n.translate(
          'email.CONTACT_CONFIRMATION_SUBJECT',
          { lang },
        ),
        lang,
      });
    } catch (err) {
      this.logger.error('Failed to queue contact message email', err);
      throw new BadGatewayException(
        this.i18n.translate('exception.EMAIL_SEND_FAILED'),
      );
    }

    return {
      status: 'success',
      message: this.i18n.translate('success.CONTACT_MESSAGE_SENT'),
    };
  }
}
