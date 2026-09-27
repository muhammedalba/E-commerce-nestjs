import { EmailService } from './email.service';

const refund = (lang: string) => ({
  email: 'a@b.c',
  orderId: 'o1',
  refundedAmount: '100',
  currency: 'SAR',
  isFull: true,
  cancelled: true,
  orderUrl: 'https://shop/ar/account/orders/o1',
  subject: 'Refund',
  lang,
});

describe('EmailService template guard', () => {
  it('sends when the template exists', async () => {
    const sendMail = jest.fn(() => Promise.resolve());
    const service = new EmailService({ sendMail } as never);

    await service.send_order_refunded(refund('ar'));

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'order-refunded-ar' }),
    );
  });

  it('fails the job instead of crashing the process when the template is missing', async () => {
    const sendMail = jest.fn(() => Promise.resolve());
    const service = new EmailService({ sendMail } as never);

    await expect(service.send_order_refunded(refund('fr'))).rejects.toThrow(
      'Email template not found: order-refunded-fr.hbs',
    );
    expect(sendMail).not.toHaveBeenCalled();
  });
});
