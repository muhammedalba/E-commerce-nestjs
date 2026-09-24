/**
 * One-off (idempotent) migration: recompute `ratingsAverage` / `ratingsQuantity`
 * on every product from its APPROVED reviews.
 *
 * Before the reviews module these fields were never computed (defaults of 2 /
 * manual values), so products showed ratings with no reviews behind them.
 * After this runs, ReviewRatingSyncService keeps them in sync on every change.
 *
 * Run:  npx ts-node scripts/recalculate-product-ratings.ts
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_URL = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skyGalaxy';

async function run() {
  await mongoose.connect(DB_URL);
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');

  const stats = await db
    .collection('reviews')
    .aggregate<{
      _id: mongoose.Types.ObjectId;
      average: number;
      count: number;
    }>([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: '$product',
          average: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const products = db.collection('products');

  // 1) Reset everything, 2) apply real values for products that have approved reviews
  const reset = await products.updateMany(
    {},
    { $set: { ratingsAverage: 0, ratingsQuantity: 0 } },
  );

  if (stats.length) {
    await products.bulkWrite(
      stats.map((s) => ({
        updateOne: {
          filter: { _id: s._id },
          update: {
            $set: {
              ratingsAverage: Math.round(s.average * 10) / 10,
              ratingsQuantity: s.count,
            },
          },
        },
      })),
    );
  }

  console.log(
    `Reset ${reset.modifiedCount} products; applied ratings to ${stats.length} products with approved reviews.`,
  );
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Rating recalculation failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
