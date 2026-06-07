import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CheckoutSessionService } from './checkout-session.service';
import { CheckoutService, CheckoutPreviewResponse } from './checkout.service';
import { CartService } from '../cart/cart.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CheckoutOrchestratorService {
  private readonly logger = new Logger(CheckoutOrchestratorService.name);
  constructor(
    private readonly sessionService: CheckoutSessionService,
    private readonly checkoutService: CheckoutService, // Acts as Pricing/Validation
    private readonly cartService: CartService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getSummary(userId: string) {
    // get data from session and cart and calculate summary
    const session = await this.sessionService.getSession(userId);

    const cartData = await this.cartService.getCart(userId);
    const cart = cartData as {
      items?: {
        product?: { _id?: { toString(): string } } | string;
        variant?:
          | {
              _id?: { toString(): string };
              attributes?: { weight?: { value?: number; unit?: string } };
            }
          | string;
        quantity: number;
        unitPrice: number;
        /** Brand snapshot stored on the CartItem at add-time. */
        brand?: { toString(): string } | string;
        /** Category snapshot stored on the CartItem at add-time. */
        category?: { toString(): string } | string;
      }[];
      totalPrice?: number;
    };

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Map cart items for the preview
    const items = cart.items.map((item) => {
      const p = item.product as { _id?: { toString(): string } } | undefined;
      const v = item.variant as
        | {
            _id?: { toString(): string };
            attributes?: { weight?: { value?: number; unit?: string } };
          }
        | undefined;

      const productId = p?._id
        ? p._id.toString()
        : typeof item.product === 'string'
          ? item.product
          : '';

      const variantId = v?._id
        ? v._id.toString()
        : typeof item.variant === 'string'
          ? item.variant
          : '';

      return {
        productId,
        variantId,
        quantity: item.quantity,
        weight: v?.attributes?.weight?.value ?? 0,
        price: item.unitPrice,
        brand:
          typeof item.brand === 'object'
            ? (item.brand?.toString() ?? '')
            : (item.brand ?? ''),
        category:
          typeof item.category === 'object'
            ? (item.category?.toString() ?? '')
            : (item.category ?? ''),
      };
    });

    // If session doesn't have cityId, we can't calculate shipping or tax properly yet
    // But we can return a partial summary
    // if (!session.cityId) {
    //   return {
    //     isComplete: false,
    //     message:
    //       'Please provide a shipping city to calculate shipping and taxes.',
    //     cartSubtotal: cart.totalPrice,
    //     items,
    //     session,
    //   };
    // }

    // Call existing checkoutService to get the full calculation
    const preview = await this.checkoutService.getCheckoutPreview(
      {
        cityId: session.cityId || '',
        paymentMethodId: session.paymentMethodId || '',
        shippingProviderId: session.shippingProviderId || '',
        couponCode: session.couponCode,
        items,
      },
      userId,
    );

    return {
      isComplete: true,
      ...preview,
      session,
    };
  }

  async setAddress(
    userId: string,
    address: { cityId?: string; [key: string]: unknown } | string,
  ) {
    const cityId = typeof address === 'string' ? address : address?.cityId;
    await this.sessionService.updateSession(userId, { address, cityId });
    return this.getSummary(userId);
  }

  async setShippingMethod(userId: string, shippingProviderId: string) {
    await this.sessionService.updateSession(userId, { shippingProviderId });
    return this.getSummary(userId);
  }

  async setPaymentMethod(userId: string, paymentMethodId: string) {
    await this.sessionService.updateSession(userId, { paymentMethodId });
    return this.getSummary(userId);
  }

  async applyCoupon(userId: string, couponCode: string) {
    await this.sessionService.updateSession(userId, { couponCode });
    return this.getSummary(userId);
  }

  async placeOrder(
    userId: string,
    userEmail: string,
    notes?: string,
    transferReceiptImg?: string,
  ) {
    // 1. Get final calculated summary
    const summaryData = await this.getSummary(userId);

    // getSummary spreads the CheckoutPreviewResponse into an object that also
    // carries `isComplete` and `session` from the checkout session.
    const summary = summaryData as CheckoutPreviewResponse & {
      isComplete: boolean;
      session: {
        address?: {
          firstName?: string;
          lastName?: string;
          phone?: string;
          countryId?: string;
          country?: string;
          cityId?: string;
          city?: string;
          street?: string;
          building?: string;
          postalCode?: string;
          additionalInfo?: string;
          addressType?: string;
        };
      };
    };

    if (!summary.isComplete) {
      throw new BadRequestException('Checkout is incomplete');
    }

    if (!summary.payment.methodId || !summary.delivery.providerId) {
      throw new BadRequestException(
        'Payment method and Shipping provider are required',
      );
    }

    // 2. Prepare order payload
    const sessionAddress = summary.session?.address || {};
    const mappedAddress = {
      firstName: sessionAddress.firstName || 'N/A', // Mongoose schema has typo `firsName`
      lastName: sessionAddress.lastName || 'N/A',
      phone: sessionAddress.phone || '0000000000',
      country: sessionAddress.countryId || sessionAddress.country || 'N/A',
      city:
        summary.delivery.cityId ||
        sessionAddress.cityId ||
        sessionAddress.city ||
        'N/A',
      street: sessionAddress.street || 'N/A',
      building: sessionAddress.building || 'N/A',
      postalCode: sessionAddress.postalCode || 'N/A',
      additionalInfo: sessionAddress.additionalInfo,
      addressType: sessionAddress.addressType || 'home',
    };

    const orderPayload = {
      user: userId,
      userEmail,
      items: summary.items,
      shippingAddress: mappedAddress,
      shippingProviderId: summary.delivery.providerId,
      shippingRateId: summary.delivery.rateId,
      paymentMethodId: summary.payment.methodId,
      shippingAmount: summary.summary.shippingCost,
      taxAmount: summary.summary.taxAmount,
      paymentFees: summary.summary.paymentFees,
      totalPrice: summary.summary.subtotal,
      discountAmount: summary.summary.discountAmount,
      grandTotal: summary.summary.totalPrice,
      currency: summary.summary.currency,
      couponDetails: summary.couponDetails,
      notes,
      transferReceiptImg,
    };

    // 3. Emit Command Event to OrderModule (Choreography / Event-Driven)
    // Here we use emitAsync so we can wait for the result if needed, or we can just emit and return pending status.
    // For synchronous creation, we can call OrderService directly, but user preferred Compensating Events.
    // However, creating the order itself is the FIRST step of the saga.
    // So we can emit a synchronous command to create the pending order,
    // OR we emit an event and the order module will pick it up.
    // Since we need to return the OrderID to the frontend immediately to proceed to payment,
    // we should wait for the order creation.

    let orderResponse: { orderId?: string } | undefined;
    try {
      this.logger.log('Emitting checkout.placeOrderCommand...');
      this.logger.log(
        'OrderPayload shippingAddress: ' +
          JSON.stringify(orderPayload.shippingAddress),
      );
      const results = await this.eventEmitter.emitAsync(
        'checkout.placeOrderCommand',
        orderPayload,
      );
      orderResponse = results[0] as { orderId?: string } | undefined;
      this.logger.log('Order event response: ' + JSON.stringify(orderResponse));
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        'Order placement event threw an error: ' + err.message,
        err.stack,
      );
      throw new BadRequestException('Failed to create order: ' + err.message);
    }

    if (!orderResponse || !orderResponse.orderId) {
      this.logger.error(
        'Order event returned no orderId. Response: ' +
          JSON.stringify(orderResponse),
      );
      throw new BadRequestException(
        'Failed to create order: listener returned no result',
      );
    }

    // 4. Clear the cart and session
    await this.cartService.clearCart(userId);
    await this.sessionService.clearSession(userId);

    // 5. Emit OrderCreated Event (starts the saga for inventory, coupon, etc)
    this.eventEmitter.emit('order.created', {
      orderId: orderResponse.orderId,
      userId,
      items: summary.items,
      couponDetails: summary.couponDetails,
    });

    const methodCode = summary.payment.methodCode;

    // 6. Payment Sessions Logic
    let paymentData: Record<string, unknown> = {};
    if (methodCode === 'stripe') {
      paymentData = {
        client_secret: `pi_mock_${orderResponse.orderId}_secret_test`,
        approvalUrl: `/checkout/payment?orderId=${orderResponse.orderId}`,
      };
    } else if (methodCode === 'paypal') {
      paymentData = {
        approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=mock_token_${orderResponse.orderId}`,
      };
    }

    return {
      success: true,
      orderId: orderResponse.orderId,
      methodCode,
      message: 'Order created successfully. Pending payment.',
      ...paymentData,
    };
  }
}
