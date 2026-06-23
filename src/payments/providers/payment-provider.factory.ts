import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentProvider } from '../shared/enums/payment-provider.enum';
import { IPaymentProvider } from './payment-provider.interface';
import { MoyasarProvider } from './moyasar.provider';

@Injectable()
export class PaymentProviderFactory {
  constructor(private readonly moyasarProvider: MoyasarProvider) {}

  /**
   * Retrieves the payment provider instance based on the provider enum/string.
   *
   * @param provider The payment provider identifier (e.g. 'moyasar')
   * @returns An instance implementing IPaymentProvider
   * @throws BadRequestException if the provider is unsupported
   */
  getProvider(provider: string): IPaymentProvider {
    switch (provider as PaymentProvider) {
      case PaymentProvider.MOYASAR:
        return this.moyasarProvider;
      // Add more providers here as needed
      // case PaymentProvider.STRIPE:
      //   return this.stripeProvider;
      default:
        throw new BadRequestException(
          `Unsupported payment provider: ${provider}`,
        );
    }
  }

  /**
   * Helper to retrieve a specific provider with type inference.
   * Useful when calling provider-specific methods like verifyWebhook.
   */
  getMoyasarProvider(): MoyasarProvider {
    return this.moyasarProvider;
  }
}
