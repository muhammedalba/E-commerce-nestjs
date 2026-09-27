import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CacheMetricsService } from './cache-metrics.service';

const config = {
  get: (k: string) => (k === 'NODE_ENV' ? 'test' : undefined),
} as unknown as ConfigService;
const metrics = () => new CacheMetricsService({} as never);

/** Fake Redis pub/sub: publish() delivers to every subscriber on the bus. */
class FakeBus {
  subscribers: FakeRedis[] = [];
}
class FakeRedis extends EventEmitter {
  status = 'ready';
  channels = new Set<string>();
  constructor(private readonly bus: FakeBus) {
    super();
    bus.subscribers.push(this);
  }
  subscribe(channel: string) {
    this.channels.add(channel);
    return Promise.resolve(1);
  }
  publish(channel: string, message: string) {
    for (const s of this.bus.subscribers) {
      if (s.channels.has(channel)) s.emit('message', channel, message);
    }
    return Promise.resolve(1);
  }
}

describe('CacheInvalidationService (versioned)', () => {
  it('bumps the version of the resource and its dependents only', async () => {
    const service = new CacheInvalidationService(metrics(), config);
    await service.clearResources(['brands']);

    expect(service.versionOf('brands')).toBe('0.1');
    expect(service.versionOf('products')).toBe('0.1'); // embeds brand names
    expect(service.versionOf('categories')).toBe('0.0');
    expect(service.versionOf('sub-category')).toBe('0.0');
  });

  it('users changes also invalidate the cached profile (auth)', async () => {
    const service = new CacheInvalidationService(metrics(), config);
    await service.clearResources(['users']);
    expect(service.versionOf('auth')).toBe('0.1');
  });

  it('expand() lists dependents once', () => {
    expect(CacheInvalidationService.expand(['brands', 'categories'])).toEqual([
      'brands',
      'products',
      'categories',
    ]);
  });

  it('broadcasts to other instances, which apply it exactly once', async () => {
    const bus = new FakeBus();
    const a = new CacheInvalidationService(
      metrics(),
      config,
      new FakeRedis(bus) as never,
      new FakeRedis(bus) as never,
    );
    const b = new CacheInvalidationService(
      metrics(),
      config,
      new FakeRedis(bus) as never,
      new FakeRedis(bus) as never,
    );
    a.onModuleInit();
    b.onModuleInit();
    await new Promise((r) => setImmediate(r)); // let subscribe() settle

    await a.clearResources(['categories']);

    // a applied locally and ignored its own echo; b applied the broadcast
    expect(a.versionOf('categories')).toBe('0.1');
    expect(b.versionOf('categories')).toBe('0.1');
    expect(b.versionOf('products')).toBe('0.1'); // dependents travel expanded
  });

  it('still invalidates locally when the broadcast fails', async () => {
    const redis = {
      publish: jest.fn().mockRejectedValue(new Error('down')),
    };
    const service = new CacheInvalidationService(
      metrics(),
      config,
      redis as never,
    );
    await expect(service.clearResources(['carousel'])).resolves.toBeUndefined();
    expect(service.versionOf('carousel')).toBe('0.1');
  });

  it('publishes on an environment-namespaced channel', async () => {
    const redis = { publish: jest.fn().mockResolvedValue(1) };
    const service = new CacheInvalidationService(
      metrics(),
      config,
      redis as never,
    );
    await service.clearResources(['brands']);
    expect(redis.publish).toHaveBeenCalledWith(
      'app-test:cache-invalidate',
      expect.stringContaining('"resources":["brands","products"]'),
    );
  });

  it('invalidateAll() changes every version token and reaches other instances', async () => {
    const bus = new FakeBus();
    const mk = () =>
      new CacheInvalidationService(
        metrics(),
        config,
        new FakeRedis(bus) as never,
        new FakeRedis(bus) as never,
      );
    const a = mk();
    const b = mk();
    a.onModuleInit();
    b.onModuleInit();
    await new Promise((r) => setImmediate(r));
    await a.clearResources(['brands']); // brands 0.1 everywhere

    await a.invalidateAll();

    for (const s of [a, b]) {
      expect(s.versionOf('brands')).toBe('1.1');
      expect(s.versionOf('never-touched')).toBe('1.0');
    }
  });
});
