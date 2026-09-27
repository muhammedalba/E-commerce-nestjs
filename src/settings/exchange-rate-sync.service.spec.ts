import { ConfigService } from '@nestjs/config';
import { ExchangeRateSyncService } from './exchange-rate-sync.service';

// Only the scheduling path is under test; skip SettingsService's import chain
jest.mock('./settings.service', () => ({ SettingsService: class {} }));

const config = {
  get: (k: string) => (k === 'NODE_ENV' ? 'test' : undefined),
} as unknown as ConfigService;

/** Shared fake Redis honouring SET key value PX ms NX. */
const fakeRedis = () => {
  const data = new Map<string, string>();
  return {
    data,
    status: 'ready',
    set: jest.fn((key: string, value: string) => {
      if (data.has(key)) return Promise.resolve(null);
      data.set(key, value);
      return Promise.resolve('OK');
    }),
  };
};

const make = (redis?: unknown) => {
  const service = new ExchangeRateSyncService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    config,
    redis as never,
  );
  const sync = jest
    .spyOn(service, 'syncExchangeRate')
    .mockResolvedValue(undefined);
  return { service, sync };
};

describe('ExchangeRateSyncService scheduled runs', () => {
  it('only one instance syncs when every instance fires together', async () => {
    const redis = fakeRedis();
    const instances = [make(redis), make(redis), make(redis)];

    await Promise.all(
      instances.map(({ service }) => service.runScheduledSync()),
    );

    const calls = instances.reduce(
      (n, { sync }) => n + sync.mock.calls.length,
      0,
    );
    expect(calls).toBe(1);
    expect(redis.set).toHaveBeenCalledWith(
      'app-test:lease:exchange-rate-sync',
      expect.any(String),
      'PX',
      5 * 60 * 1000,
      'NX',
    );
  });

  it('syncs locally without Redis', async () => {
    const { service, sync } = make();
    await service.runScheduledSync();
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('syncs locally when Redis errors', async () => {
    const { service, sync } = make({
      status: 'ready',
      set: jest.fn().mockRejectedValue(new Error('Connection is closed.')),
    });
    await service.runScheduledSync();
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
