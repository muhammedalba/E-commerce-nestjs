import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT, redisNamespace } from 'src/shared/redis/redis.module';
import { RedisLock } from './backup-lock';
import { BackupConfig } from './backup.config';
import { GoogleDriveClient } from './google-drive.client';

/** Lease for a running backup; renewed every 40 s while the backup runs. */
const BACKUP_LOCK_TTL_MS = 120_000;
/** Lease for a scheduler sync (a few Redis/Mongo round-trips). */
const SCHEDULER_LOCK_TTL_MS = 30_000;

/** Cluster-wide locks, namespaced per environment like every app key. */
@Injectable()
export class BackupLocks {
  /** Held for the whole backup (export → upload → retention). */
  readonly backup: RedisLock;
  /** Serializes scheduler upserts/removals across instances. */
  readonly scheduler: RedisLock;

  constructor(
    config: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) redis?: Redis,
  ) {
    const ns = redisNamespace(config);
    this.backup = new RedisLock(
      redis,
      `${ns}:lock:db-backup`,
      BACKUP_LOCK_TTL_MS,
    );
    this.scheduler = new RedisLock(
      redis,
      `${ns}:lock:db-backup-scheduler`,
      SCHEDULER_LOCK_TTL_MS,
    );
  }
}

/**
 * The Drive client for the server-side OAuth credentials. One shared client:
 * its OAuth client caches the access token (~1 h) instead of exchanging the
 * refresh token on every request. The credentials come from the environment
 * and cannot change while the process runs.
 */
@Injectable()
export class GoogleDriveClientFactory {
  private client: GoogleDriveClient | null = null;

  constructor(private readonly config: BackupConfig) {}

  create(): GoogleDriveClient {
    this.client ??= GoogleDriveClient.fromOAuth(this.config.driveCredentials);
    return this.client;
  }
}
