/**
 * One-off (idempotent) migration: lower-case the `module` of existing audit
 * log entries ('ORDER' -> 'order', 'PAYMENT' -> 'payment').
 *
 * AuditService.log now normalises every new entry, and the dashboard filters
 * by exact (lower-case) value, so older entries need the same shape.
 *
 * Run:  npx ts-node scripts/normalize-audit-modules.ts
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_URL = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skyGalaxy';

async function run() {
  // Use the instance connect() returns: with `import * as`, the namespace
  // object does not carry mongoose's prototype getters (`connection`).
  // Same database as the app (src/config/db/mongoose.config.ts).
  const conn = await mongoose.connect(DB_URL, {
    dbName: process.env.MONGODB_DB_NAME || 'skyGalaxy',
  });
  try {
    const db = conn.connection.db;
    if (!db) throw new Error('No database connection');

    const result = await db
      .collection('auditlogs')
      .updateMany({ $expr: { $ne: ['$module', { $toLower: '$module' }] } }, [
        { $set: { module: { $toLower: '$module' } } },
      ]);

    console.log(`✅ Normalised ${result.modifiedCount} audit log entries.`);
  } finally {
    await conn.disconnect();
  }
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exitCode = 1;
});
