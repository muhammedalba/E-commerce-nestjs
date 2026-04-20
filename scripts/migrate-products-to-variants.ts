/**
 * MIGRATION SCRIPT (Corrected for new backend architecture)
 * Product → Product + ProductVariant
 */

import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.DB_URI ||
  'mongodb://localhost:27017/skygalaxy';

interface LegacyProduct {
  _id: mongoose.Types.ObjectId;
  title: { en?: string; ar?: string } | string;
  slug: string;
  price?: number;
  priceAfterDiscount?: number;
  quantity?: number;
  sold?: number;
  colors?: string[];
  isUnlimitedStock?: boolean;
  disabled?: boolean;
}

let skuCounter = 0;
function generateSku(slug: string, suffix: string = ''): string {
  skuCounter++;
  const base = slug.toUpperCase().replace(/[^A-Z0-9]/g, '-').substring(0, 15);
  const counter = String(skuCounter).padStart(4, '0');
  return suffix ? `${base}-${suffix}-${counter}` : `${base}-${counter}`;
}

async function migrate() {
  console.log('🚀 Starting migration...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Failed to connect to database');
  }
  const productsCollection = db.collection('products');
  const variantsCollection = db.collection('productvariants');

  const products = await productsCollection.find({}).toArray() as LegacyProduct[];

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const hasVariants = await variantsCollection.countDocuments({
        productId: product._id,
      });

      if (hasVariants > 0) {
        console.log(`⏭️ Skipping ${product.slug} (already migrated)`);
        skipped++;
        continue;
      }

      const variants: any[] = [];

      if (product.colors?.length) {
        for (const color of product.colors) {
          variants.push({
            productId: product._id,
            sku: generateSku(product.slug, color.toUpperCase()),
            price: product.price ?? 0,
            priceAfterDiscount: product.priceAfterDiscount,
            stock: Math.floor((product.quantity ?? 1) / product.colors.length),
            sold: Math.floor((product.sold ?? 0) / product.colors.length),
            attributes: { color },
            components: [],
            isActive: true,
            isDeleted: false,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } else {
        variants.push({
          productId: product._id,
          sku: generateSku(product.slug, 'DEFAULT'),
          price: product.price ?? 0,
          priceAfterDiscount: product.priceAfterDiscount,
          stock: product.quantity ?? 1,
          sold: product.sold ?? 0,
          attributes: {},
          components: [],
          label: 'Default',
          isActive: true,
          isDeleted: false,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await variantsCollection.insertMany(variants);

      const prices = variants.map((v) => v.price);
      const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);

      const allowedAttributes =
        product.colors?.length
          ? [
            {
              name: 'color',
              type: 'string',
              required: true,
              allowedValues: [...new Set(product.colors)],
            },
          ]
          : [];

      await productsCollection.updateOne(
        { _id: product._id },
        {
          $unset: {
            price: '',
            priceAfterDiscount: '',
            quantity: '',
            sold: '',
            colors: '',
          },
          $set: {
            isDeleted: false,
            deletedAt: null,
            allowedAttributes,
            allowedAttributesVersion: 1,
            priceRange: {
              min: Math.min(...prices),
              max: Math.max(...prices),
            },
            stockSummary: totalStock,
            variantCount: variants.length,
          },
        },
      );

      console.log(`✅ Migrated ${product.slug} → ${variants.length} variants`);
      migrated++;
    } catch (err) {
      console.error(`❌ Error migrating ${product.slug}:`, err);
      errors++;
    }
  }

  console.log('\n📊 Migration Summary');
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Errors:   ${errors}`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('💥 Fatal migration error:', err);
  process.exit(1);
});
