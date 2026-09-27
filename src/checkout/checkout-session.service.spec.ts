import { ConfigService } from '@nestjs/config';
import { createCache } from 'cache-manager';
import { CheckoutSessionService } from './checkout-session.service';

const config = {
  get: (k: string) => (k === 'NODE_ENV' ? 'test' : undefined),
} as unknown as ConfigService;

/** Minimal in-memory stand-in for the ioredis commands used. */
const fakeRedis = () => {
  const data = new Map<string, string>();
  return {
    data,
    get: jest.fn((k: string) => Promise.resolve(data.get(k) ?? null)),
    set: jest.fn((k: string, v: string) => {
      data.set(k, v);
      return Promise.resolve('OK');
    }),
    del: jest.fn((k: string) => Promise.resolve(Number(data.delete(k)))),
  };
};
const downRedis = () => {
  const fail = () => Promise.reject(new Error('Connection is closed.'));
  return { get: jest.fn(fail), set: jest.fn(fail), del: jest.fn(fail) };
};

describe('CheckoutSessionService', () => {
  it('stores sessions in Redis under an env-namespaced key with a 1h TTL', async () => {
    const redis = fakeRedis();
    const service = new CheckoutSessionService(
      redis as never,
      createCache({}),
      config,
    );

    await service.updateSession('u1', { cityId: 'c1' });
    await service.updateSession('u1', { couponCode: 'SAVE' });

    expect(redis.set).toHaveBeenLastCalledWith(
      'app-test:checkout-session:u1',
      JSON.stringify({ cityId: 'c1', couponCode: 'SAVE' }),
      'EX',
      3600,
    );
    await expect(service.getSession('u1')).resolves.toEqual({
      cityId: 'c1',
      couponCode: 'SAVE',
    });

    await service.clearSession('u1');
    await expect(service.getSession('u1')).resolves.toEqual({});
  });

  it('falls back to the in-process cache when Redis is down', async () => {
    const service = new CheckoutSessionService(
      downRedis() as never,
      createCache({}),
      config,
    );

    await service.updateSession('u1', { shippingRateId: 'r1' });
    await expect(service.getSession('u1')).resolves.toEqual({
      shippingRateId: 'r1',
    });

    await service.clearSession('u1');
    await expect(service.getSession('u1')).resolves.toEqual({});
  });
});
