import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_URL =
  process.env.DB_URL ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/skyGalaxy';

interface LegacyMigrationSpec {
  collection: string;
  singleFields: string[];
  arrayFields: string[];
}

const COLLECTIONS_TO_MIGRATE: LegacyMigrationSpec[] = [
  {
    collection: 'products',
    singleFields: ['imageCover', 'infoProductPdf'],
    arrayFields: ['images'],
  },
  {
    collection: 'brands',
    singleFields: ['image'],
    arrayFields: [],
  },
  {
    collection: 'categories',
    singleFields: ['image'],
    arrayFields: [],
  },
  {
    collection: 'users',
    singleFields: ['avatar'],
    arrayFields: [],
  },
  {
    collection: 'suppliers',
    singleFields: ['avatar'],
    arrayFields: [],
  },
  {
    collection: 'carousels',
    singleFields: ['carouselSm', 'carouselMd', 'carouselLg'],
    arrayFields: [],
  },
  {
    collection: 'settings',
    singleFields: ['logo', 'favicon'],
    arrayFields: [],
  },
  {
    collection: 'shippingproviders',
    singleFields: ['logo'],
    arrayFields: [],
  },
  {
    collection: 'orders',
    singleFields: ['transferReceiptImg', 'InvoicePdf', 'DeliveryReceiptImage'],
    arrayFields: [],
  },
];

function transformStringToAsset(val: any): any {
  if (!val) return val;
  if (typeof val === 'string') {
    const isCloudinary = val.includes('res.cloudinary.com');
    return {
      url: val,
      publicId: val,
      provider: isCloudinary ? 'cloudinary' : 'local',
    };
  }
  if (typeof val === 'object' && val !== null) {
    if (!val.provider) {
      const isCloudinary = (val.url || '').includes('res.cloudinary.com');
      return {
        url: val.url || '',
        publicId: val.publicId || val.url || '',
        provider: isCloudinary ? 'cloudinary' : 'local',
      };
    }
    return val;
  }
  return val;
}

async function runMigration() {
  console.log(`Connecting to database: ${DB_URL}`);
  await mongoose.connect(DB_URL);
  console.log(
    'Connected successfully. Starting migration of file strings to FileAsset objects...\n',
  );

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database handle is undefined');
  }

  for (const spec of COLLECTIONS_TO_MIGRATE) {
    const collection = db.collection(spec.collection);
    const docs = await collection.find({}).toArray();
    let updatedCount = 0;

    for (const doc of docs) {
      const updateSet: Record<string, any> = {};
      let needsUpdate = false;

      // Handle single fields
      for (const field of spec.singleFields) {
        const val = doc[field];
        if (typeof val === 'string' && val.trim() !== '') {
          updateSet[field] = transformStringToAsset(val);
          needsUpdate = true;
        } else if (typeof val === 'object' && val !== null && !val.provider) {
          updateSet[field] = transformStringToAsset(val);
          needsUpdate = true;
        }
      }

      // Handle array fields
      for (const field of spec.arrayFields) {
        const arr = doc[field];
        if (Array.isArray(arr) && arr.length > 0) {
          const hasStrings = arr.some(
            (item) =>
              typeof item === 'string' ||
              (typeof item === 'object' && !item.provider),
          );
          if (hasStrings) {
            updateSet[field] = arr.map((item) => transformStringToAsset(item));
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        await collection.updateOne({ _id: doc._id }, { $set: updateSet });
        updatedCount++;
      }
    }

    console.log(
      `[✓] Collection "${spec.collection}": ${updatedCount} / ${docs.length} documents updated.`,
    );
  }

  console.log(
    '\nMigration complete! All documents now adhere to FileAsset schema.',
  );
  await mongoose.disconnect();
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
