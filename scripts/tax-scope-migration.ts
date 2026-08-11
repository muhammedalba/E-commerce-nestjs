import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

// Execute via: npx tsx scripts/tax-scope-migration.ts

dotenv.config();

async function run() {
  console.log('Mongo URI:', process.env.MONGODB_URI);
  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: 'skyGalaxy',
  });
  console.log('Connected to MongoDB');

  const taxesCollection = mongoose.connection.collection('taxes');

  // Find all taxes that do not have a scope field
  const oldTaxes = await taxesCollection.find({ scope: { $exists: false } }).toArray();
  console.log(`Found ${oldTaxes.length} tax documents requiring migration.`);

  for (const tax of oldTaxes) {
    let inferredScope = 'global';

    if (tax.country) {
      inferredScope = 'country';
    }

    await taxesCollection.updateOne(
      { _id: tax._id },
      {
        $set: {
          scope: inferredScope,
          region: tax.region || null,
          city: tax.city || null,
        },
      }
    );
    console.log(`Migrated tax "${tax.name}" (${tax._id}): scope=${inferredScope}`);
  }

  try {
    console.log('Dropping old conflicting index "country_1"...');
    await taxesCollection.dropIndex('country_1');
    console.log('Successfully dropped "country_1" index.');
  } catch (err: any) {
    if (err.codeName !== 'IndexNotFound') {
      console.warn('Warning: Could not drop "country_1" index:', err.message);
    } else {
      console.log('Index "country_1" not found. Skipping.');
    }
  }

  try {
    console.log('Dropping old conflicting index "name_1"...');
    await taxesCollection.dropIndex('name_1');
    console.log('Successfully dropped "name_1" index.');
  } catch (err: any) {
    if (err.codeName !== 'IndexNotFound') {
      console.warn('Warning: Could not drop "name_1" index:', err.message);
    } else {
      console.log('Index "name_1" not found. Skipping.');
    }
  }

  console.log('✅ Tax scope migration completed successfully!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
