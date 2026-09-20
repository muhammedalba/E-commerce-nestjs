import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { CreateQuoteRequestDto } from './shared/dto/create-quote-request.dto';
import { CustomerType } from './shared/enums/customer-type.enum';
import { PreferredContactMethod } from './shared/enums/preferred-contact-method.enum';

const CUSTOMER_TYPE_LABEL_KEYS: Record<CustomerType, string> = {
  [CustomerType.INDIVIDUAL]: 'email.QUOTE_CUSTOMER_TYPE_INDIVIDUAL',
  [CustomerType.COMPANY]: 'email.QUOTE_CUSTOMER_TYPE_COMPANY',
};

const CONTACT_METHOD_LABEL_KEYS: Record<PreferredContactMethod, string> = {
  [PreferredContactMethod.PHONE]: 'email.QUOTE_CONTACT_METHOD_PHONE',
  [PreferredContactMethod.EMAIL]: 'email.QUOTE_CONTACT_METHOD_EMAIL',
};

@Injectable()
export class QuoteRequestsService {
  private readonly logger = new Logger(QuoteRequestsService.name);

  constructor(
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
    private readonly i18n: I18nService,
  ) {}

  async submitRequest(dto: CreateQuoteRequestDto) {
    const lang =
      I18nContext.current()?.lang || process.env.DEFAULT_LANGUAGE || 'ar';

    try {
      await this.mailQueue.add('quote-request', {
        customerType: dto.customerType,
        customerTypeLabel: this.i18n.translate(
          CUSTOMER_TYPE_LABEL_KEYS[dto.customerType],
          { lang },
        ),
        name: dto.name,
        phone: dto.phone,
        emails: dto.emails,
        preferredContactMethodLabel: this.i18n.translate(
          CONTACT_METHOD_LABEL_KEYS[dto.preferredContactMethod],
          { lang },
        ),
        orderDetails: dto.orderDetails,
        deliveryAddress: dto.deliveryAddress,
        commercialRegistrationNumber: dto.commercialRegistrationNumber,
        taxNumber: dto.taxNumber,
        nationalAddress: dto.nationalAddress,
        adminSubject: this.i18n.translate('email.QUOTE_ADMIN_SUBJECT', {
          lang,
        }),
        confirmationSubject: this.i18n.translate(
          'email.QUOTE_CONFIRMATION_SUBJECT',
          { lang },
        ),
        lang,
      });
    } catch (err) {
      this.logger.error('Failed to queue quote request email', err);
      throw new BadGatewayException(
        this.i18n.translate('exception.EMAIL_SEND_FAILED'),
      );
    }

    return {
      status: 'success',
      message: this.i18n.translate('success.QUOTE_REQUEST_SENT'),
    };
  }
}
