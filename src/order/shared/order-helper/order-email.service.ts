import { BadGatewayException, Injectable } from '@nestjs/common';
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
    price: number;
    quantity: number;
    sold: number;
    isUnlimitedStock?: boolean;
  };
  quantity: number;
  totalPrice?: number;
};
@Injectable()
export class OrderEmailService {
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
            price: item.product.price.toString(),
            quantity: item.product.quantity.toString(),
            imageCover: item.product.imageCover,
          },
          quantity: item.quantity.toString(),
          totalPrice:
            item.totalPrice?.toString() ??
            (item.product.price * item.quantity).toString(),
        })),
        this.i18n.translate('email.NEW_ORDER_SUBJECT', {
          args: { name: 'codeProps' },
        }),
      );
    } catch (err) {
      console.log('error send email', err);
      throw new BadGatewayException(
        this.i18n.translate('exception.EMAIL_SEND_FAILED'),
      );
    }
  }
}
