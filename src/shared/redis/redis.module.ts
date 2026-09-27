import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const REDIS_SUBSCRIBER = Symbol('REDIS_SUBSCRIBER');

/**
 * Prefix for every app key / channel in Redis. The same Redis instance is
 * shared by environments (see bull.config: `bull-${NODE_ENV}`), so keys are
 * namespaced per environment — local dev never touches production data.
 */
export const redisNamespace = (config: ConfigService) =>
  `app-${config.get<string>('NODE_ENV') || 'development'}`;

function createClient(config: ConfigService, name: string): Redis {
  const url = config.getOrThrow<string>('REDIS_URL');
  const logger = new Logger(`Redis:${name}`);
  const client = new Redis(url, {
    tls: url.startsWith('rediss://')
      ? { rejectUnauthorized: false }
      : undefined,
    // Fail fast instead of hanging requests: callers fall back when Redis is
    // unreachable (checkout sessions → memory, invalidation → local only).
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    commandTimeout: 3000,
    retryStrategy: (times) => Math.min(times * 1000, 10_000),
  });
  client.on('error', (err) => logger.warn(err.message));
  return client;
}

@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
  ) {}

  async onModuleDestroy() {
    await Promise.allSettled([this.client.quit(), this.subscriber.quit()]);
  }
}

/**
 * App-wide Redis connections (separate from BullMQ's):
 * - REDIS_CLIENT: commands (checkout sessions, pub/sub publish).
 * - REDIS_SUBSCRIBER: a dedicated connection for SUBSCRIBE (a subscribed
 *   connection can't run other commands).
 *
 * Deliberately NOT used as a response cache: this Redis is shared with BullMQ
 * and runs `noeviction` (required by BullMQ) — cache growth would make Redis
 * reject writes, including queue jobs.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createClient(config, 'client'),
    },
    {
      provide: REDIS_SUBSCRIBER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createClient(config, 'subscriber'),
    },
    RedisLifecycle,
  ],
  exports: [REDIS_CLIENT, REDIS_SUBSCRIBER],
})
export class RedisModule {}
