import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { Redis } from 'ioredis';
import { REDIS_CLIENT, redisNamespace } from 'src/shared/redis/redis.module';

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

const SESSION_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Checkout progress (address, shipping, payment, coupon) per user.
 *
 * Stored in Redis so it survives restarts/deploys and is shared by every
 * server instance (it used to live in process memory: a restart wiped
 * everyone's checkout, and with several instances it could randomly vanish).
 *
 * If Redis is unreachable, falls back to the in-process cache so checkout
 * keeps working on a single instance (logged as a warning).
 */
@Injectable()
export class CheckoutSessionService {
  private readonly logger = new Logger(CheckoutSessionService.name);
  private readonly prefix: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(CACHE_MANAGER) private readonly fallback: Cache,
    config: ConfigService,
  ) {
    this.prefix = `${redisNamespace(config)}:checkout-session:`;
  }

  private key(userId: string): string {
    return `${this.prefix}${userId}`;
  }

  async getSession(userId: string): Promise<CheckoutSessionData> {
    try {
      const raw = await this.redis.get(this.key(userId));
      return raw ? (JSON.parse(raw) as CheckoutSessionData) : {};
    } catch (err) {
      this.warnFallback('read', err);
      return (
        (await this.fallback.get<CheckoutSessionData>(this.key(userId))) ?? {}
      );
    }
  }

  async updateSession(
    userId: string,
    data: Partial<CheckoutSessionData>,
  ): Promise<CheckoutSessionData> {
    const newSession = { ...(await this.getSession(userId)), ...data };
    try {
      await this.redis.set(
        this.key(userId),
        JSON.stringify(newSession),
        'EX',
        SESSION_TTL_SECONDS,
      );
    } catch (err) {
      this.warnFallback('write', err);
      await this.fallback.set(
        this.key(userId),
        newSession,
        SESSION_TTL_SECONDS * 1000,
      );
    }
    return newSession;
  }

  async clearSession(userId: string): Promise<void> {
    // Clear both, so a session written during a Redis outage can't resurface
    await Promise.allSettled([
      this.redis.del(this.key(userId)),
      this.fallback.del(this.key(userId)),
    ]);
  }

  private warnFallback(op: string, err: unknown) {
    this.logger.warn(
      `Redis ${op} failed, using in-memory checkout session: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
