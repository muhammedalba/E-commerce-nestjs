import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CheckoutSessionService } from './checkout-session.service';
import { CheckoutService } from './checkout.service';
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
    const session = await this.sessionService.getSession(userId);
    const cart: any = await this.cartService.getCart(userId);

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Map cart items for the preview
    const items = cart.items.map((item: any) => ({
      productId: item.product._id ? item.product._id.toString() : item.product,
      variantId: item.variant._id ? item.variant._id.toString() : item.variant,
      quantity: item.quantity,
      weight: item.variant.weight || 0, // Assuming weight is on variant
      price: item.unitPrice,
    }));

    // If session doesn't have cityId, we can't calculate shipping or tax properly yet
    // But we can return a partial summary
    if (!session.cityId) {
      return {
        isComplete: false,
        message:
          'Please provide a shipping city to calculate shipping and taxes.',
        cartSubtotal: cart.totalPrice,
        items,
        session,
      };
    }

    // Call existing checkoutService to get the full calculation
    const preview = await this.checkoutService.getCheckoutPreview(
      {
        cityId: session.cityId,
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

  async setAddress(userId: string, address: any) {
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
    const summary: any = await this.getSummary(userId);

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
      firsName: sessionAddress.firstName || sessionAddress.firsName || 'N/A', // Mongoose schema has typo `firsName`
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
      discountAmount: summary.summary.discount,
      grandTotal: summary.summary.total,
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

    let orderResponse: any;
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
      orderResponse = results[0];
      this.logger.log('Order event response: ' + JSON.stringify(orderResponse));
    } catch (error: any) {
      this.logger.error(
        'Order placement event threw an error: ' + error.message,
        error.stack,
      );
      throw new BadRequestException('Failed to create order: ' + error.message);
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

    return {
      success: true,
      orderId: orderResponse.orderId,
      message: 'Order created successfully. Pending payment.',
    };
  }
}
