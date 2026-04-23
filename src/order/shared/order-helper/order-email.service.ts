import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { I18nService } from 'nestjs-i18n';
import { EmailService } from 'src/email/email.service';
import { HydratedDocument } from 'mongoose';
import { Order } from '../schemas/Order.schema';

type OrderDocument = HydratedDocument<Order>;

type ValidatedItem = {
  product: {
    id: Types.ObjectId;
    imageCover: string;
    brand: string;
    category: string;
    title: string;
    isUnlimitedStock?: boolean;
  };
  variant: {
    id: Types.ObjectId;
    price: number;
    stock: number;
    sold: number;
    sku: string;
    attributes: Record<string, unknown>;
  };
  quantity: number;
  totalPrice?: number;
};

@Injectable()
export class OrderEmailService {
  private readonly logger = new Logger(OrderEmailService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
  ) {}

  async sendOrderEmail(
    order: OrderDocument,
    validatedItems: ValidatedItem[],
    user_email: string,
  ) {
    try {
      await this.emailService.new_admin_order(
        process.env.APP_NAME || 'admin',
        user_email,
        order.createdAt ? order.createdAt.toISOString() : '',
        order.totalPriceAfterDiscount?.toString() ??
          order.totalPrice.toString(),
        `${process.env.BASE_URL}/api/v1/order/${order._id?.toString() ?? ''}`,
        order._id?.toString() ?? '',
        validatedItems.map((item) => ({
          product: {
            id: item.product.id.toString(),
            title: item.product.title,
            price: item.variant.price.toString(),
            quantity: item.variant.stock.toString(),
            imageCover: item.product.imageCover,
          },
          quantity: item.quantity.toString(),
          totalPrice:
            item.totalPrice?.toString() ??
            (item.variant.price * item.quantity).toString(),
        })),
        this.i18n.translate('email.NEW_ORDER_SUBJECT', {
          args: { name: 'codeProps' },
        }),
      );
    } catch (err) {
      this.logger.error('Failed to send order email', err);
      throw new BadGatewayException(
        this.i18n.translate('exception.EMAIL_SEND_FAILED'),
      );
    }
  }
}
