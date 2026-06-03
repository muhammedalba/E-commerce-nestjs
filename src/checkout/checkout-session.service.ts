import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface CheckoutSessionData {
  address?: any;
  cityId?: string;
  shippingProviderId?: string;
  shippingRateId?: string;
  shippingCost?: number;
  paymentMethodId?: string;
  couponCode?: string;
  discountAmount?: number;
  notes?: string;
}

@Injectable()
export class CheckoutSessionService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  private getSessionKey(userId: string): string {
    return `checkout_session_${userId}`;
  }

  async getSession(userId: string): Promise<CheckoutSessionData> {
    const session = await this.cacheManager.get<CheckoutSessionData>(
      this.getSessionKey(userId),
    );
    return session || {};
  }

  async updateSession(
    userId: string,
    data: Partial<CheckoutSessionData>,
  ): Promise<CheckoutSessionData> {
    const currentSession = await this.getSession(userId);
    const newSession = { ...currentSession, ...data };

    // cache-manager v5 uses milliseconds. 3600000 ms = 1 hour.
    await this.cacheManager.set(
      this.getSessionKey(userId),
      newSession,
      3600000,
    );
    return newSession;
  }

  async clearSession(userId: string): Promise<void> {
    await this.cacheManager.del(this.getSessionKey(userId));
  }
}
