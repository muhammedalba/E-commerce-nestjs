/**
 * Starts one disposable in-memory MongoDB replica set for the whole e2e run
 * and points every e2e suite at it, so they never touch the database in
 * `.env`. A replica set (not a standalone server) because the backup suite
 * needs snapshot reads.
 *
 * Jest workers are spawned after this runs and inherit `process.env`, which
 * takes precedence over `.env` in ConfigModule.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';

declare global {
  var __E2E_MONGO__: MongoMemoryReplSet | undefined;
}

export default async function globalSetup(): Promise<void> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  globalThis.__E2E_MONGO__ = replSet;

  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME = 'sky_e2e';
  process.env.BACKUP_TEST_MONGODB_URI = uri;
  // Namespaces every Redis key and BullMQ queue (`app-test`, `bull-test`) so
  // the e2e app never shares jobs, schedules or sessions with dev/production.
  process.env.NODE_ENV = 'test';
}
