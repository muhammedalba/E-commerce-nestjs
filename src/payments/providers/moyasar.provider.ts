import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  IPaymentProvider,
  PaymentSessionResult,
} from './payment-provider.interface';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class MoyasarProvider implements IPaymentProvider {
  private readonly logger = new Logger(MoyasarProvider.name);

  constructor(private readonly httpService: HttpService) {}

  async createSession(
    orderId: string,
    amount: number,
    currency: string,
    userEmail: string,
    metadata?: Record<string, any>,
  ): Promise<PaymentSessionResult> {
    try {
      const MOYASAR_SECRET_KEY = process.env.MOYASAR_SECRET_KEY;
      const callbackUrl = `${process.env.FRONTEND_ORIGIN || 'http://localhost:3000'}/checkout/callback`;

      // Moyasar amount is in halalas/cents (e.g., 100 SAR = 10000)
      const amountInHalalas = Math.round(amount * 100);
      let currencyCode = (currency || 'SAR').toUpperCase().trim();
      if (currencyCode === 'ر.س' || currencyCode === 'ر.س.') {
        currencyCode = 'SAR';
      }
      const payload = {
        amount: amountInHalalas,
        currency: currencyCode,
        description: `Order ${orderId}`,
        success_url: callbackUrl,
        back_url: callbackUrl,
        metadata: {
          ...metadata,
          orderId,
        },
      };

      const authHeader = `Basic ${Buffer.from(`${MOYASAR_SECRET_KEY}:`).toString('base64')}`;

      const response = await lastValueFrom(
        this.httpService.post('https://api.moyasar.com/v1/invoices', payload, {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
        }),
      );

      const data = response.data;

      return {
        providerPaymentId: data.id,
        paymentUrl: data.url,
        status: 'PENDING',
      };
    } catch (error: any) {
      this.logger.error(
        `Moyasar session creation failed for order ${orderId}: ${error.message}`,
      );
      if (error.response && error.response.data) {
        this.logger.error(
          `Moyasar Error Data: ${JSON.stringify(error.response.data)}`,
        );
      }
      return {
        status: 'FAILED',
        errorMessage: error.response?.data?.message || error.message,
      };
    }
  }

  async fetchInvoice(invoiceId: string): Promise<any> {
    const MOYASAR_SECRET_KEY = process.env.MOYASAR_SECRET_KEY;
    const authHeader = `Basic ${Buffer.from(`${MOYASAR_SECRET_KEY}:`).toString('base64')}`;

    try {
      const response = await lastValueFrom(
        this.httpService.get(
          `https://api.moyasar.com/v1/invoices/${invoiceId}`,
          {
            headers: {
              Authorization: authHeader,
            },
          },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch Moyasar invoice ${invoiceId}: ${error.message}`,
      );
      return null;
    }
  }
}
