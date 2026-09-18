import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

/**
 * BullConfig - Configuration for BullMQ using Redis.
 * This configuration handles dynamic connection settings and resilient retry strategies
 * to ensure background jobs stay active even during network instability.
 */

export const BullConfig = BullModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => {
    const redisUrl = config.get<string>('REDIS_URL');

    // 1. Create the connection instance manually for advanced control
    const redisClient = new Redis(redisUrl!, {
      tls: redisUrl?.startsWith('rediss://')
        ? { rejectUnauthorized: false }
        : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: true, // Important: enable offline queue to buffer commands during disconnection
      lazyConnect: true, // Important: don't connect until explicitly requested

      // 2. Resilience strategy: Reconnection logic for network drops or slow internet
      retryStrategy: (times) => {
        const delay = Math.min(times * 1000, 5000);
        console.warn(
          `[Redis] Reconnection attempt #${times} after ${delay}ms...`,
        );
        return delay; // Returning a number tells ioredis to try again after this delay instead of crashing the server
      },
    });
    redisClient.on('error', (err) => {
      console.error(`[Redis Error] - ${err.message}`);
    });

    // Namespace all queue keys by environment so local dev never races
    // production for jobs when both share the same Redis instance — each
    // gets its own isolated set of BullMQ keys/queues under the hood.
    const nodeEnv = config.get<string>('NODE_ENV') || 'development';

    return {
      connection: redisClient,
      prefix: `bull-${nodeEnv}`,
    };
  },
  inject: [ConfigService],
});
