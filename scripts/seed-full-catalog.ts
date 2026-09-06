import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import {
  FULL_CATALOG_BRANDS,
  FULL_CATALOG_CATEGORIES,
  FULL_CATALOG_PRODUCTS,
} from '../src/seed/full-catalog-data';

// Run with: npx tsx scripts/seed-full-catalog.ts

dotenv.config();

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(mongoUri, {
    dbName: 'skyGalaxy',
  });
  console.log('✅ Connected to MongoDB (skyGalaxy)');

  const Brand = mongoose.connection.collection('brands');
  const Category = mongoose.connection.collection('categories');
  const SubCategory = mongoose.connection.collection('subcategories');
  const Product = mongoose.connection.collection('products');
  const ProductVariant = mongoose.connection.collection('productvariants');

  // 1. Seed All Brands
  console.log(`\n🏷️ Seeding ${FULL_CATALOG_BRANDS.length} Brands...`);
  const brandMap = new Map<string, mongoose.Types.ObjectId>();

  for (const b of FULL_CATALOG_BRANDS) {
    let brandDoc = await Brand.findOne({ slug: b.slug });
    if (!brandDoc) {
      const res = await Brand.insertOne({
        name: b.name,
        slug: b.slug,
        image: {
          url: `/uploads/Brand/default.png`,
          publicId: `/uploads/Brand/default.png`,
          provider: 'local',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      brandDoc = await Brand.findOne({ _id: res.insertedId });
      console.log(`  ➕ Created Brand: ${b.name.ar} (${b.slug})`);
    } else {
      console.log(`  ℹ️ Brand already exists: ${b.name.ar}`);
    }
    brandMap.set(b.slug, brandDoc!._id as mongoose.Types.ObjectId);
  }

  // 2. Seed All Categories & SubCategories
  console.log(`\n📁 Seeding ${FULL_CATALOG_CATEGORIES.length} Categories...`);
  const subCategoryMap = new Map<
    string,
    {
      categoryId: mongoose.Types.ObjectId;
      subCategoryId: mongoose.Types.ObjectId;
    }
  >();

  for (const cat of FULL_CATALOG_CATEGORIES) {
    let categoryDoc = await Category.findOne({ slug: cat.slug });
    if (!categoryDoc) {
      const res = await Category.insertOne({
        name: cat.name,
        slug: cat.slug,
        image: {
          url: `/uploads/Category/default.png`,
          publicId: `/uploads/Category/default.png`,
          provider: 'local',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      categoryDoc = await Category.findOne({ _id: res.insertedId });
      console.log(`  📁 Created Category: ${cat.name.ar} (${cat.slug})`);
    }

    for (const sub of cat.subCategories) {
      let subDoc = await SubCategory.findOne({ slug: sub.slug });
      if (!subDoc) {
        const res = await SubCategory.insertOne({
          name: sub.name,
          slug: sub.slug,
          category: categoryDoc!._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        subDoc = await SubCategory.findOne({ _id: res.insertedId });
        console.log(`    📂 Created SubCategory: ${sub.name.ar} (${sub.slug})`);
      } else {
        await SubCategory.updateOne(
          { _id: subDoc._id },
          { $set: { category: categoryDoc!._id, name: sub.name } },
        );
      }
      subCategoryMap.set(sub.slug, {
        categoryId: categoryDoc!._id as mongoose.Types.ObjectId,
        subCategoryId: subDoc!._id as mongoose.Types.ObjectId,
      });
    }
  }

  // 3. Seed Products & Variants
  console.log(
    `\n📦 Seeding ${FULL_CATALOG_PRODUCTS.length} Product Families...`,
  );
  let totalVariantsSeeded = 0;

  for (const productFamily of FULL_CATALOG_PRODUCTS) {
    const classification = subCategoryMap.get(productFamily.subCategorySlug);
    if (!classification) {
      console.warn(
        `⚠️ Warning: Subcategory not found for slug: ${productFamily.subCategorySlug}`,
      );
      continue;
    }

    const brandId = brandMap.get(productFamily.brandSlug);
    const { categoryId, subCategoryId } = classification;

    const prices = productFamily.variants.map((v) => v.price);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const totalStock = productFamily.variants.reduce(
      (sum, v) => sum + v.stock,
      0,
    );

    let productDoc = await Product.findOne({ slug: productFamily.slug });
    const productPayload = {
      title: productFamily.title,
      slug: productFamily.slug,
      description: productFamily.description,
      category: categoryId,
      SubCategories: [subCategoryId],
      brand: brandId,
      // i need to remove the spaces from the attribute names and convert them to camelcase
      allowedAttributes: productFamily.allowedAttributes?.map((attr) => {
        return {
          ...attr,
          name: attr.name.trim().toLowerCase(),
        };
      }),
      allowedAttributesVersion: 1,
      imageCover: {
        url: `/uploads/Product/default.png`,
        publicId: '/upload/Product/default.png',
        provider: 'local',
      },
      images: [],
      uses: { ar: [], en: [] },
      isUnlimitedStock: false,
      isActive: true,
      priceRange: { min: minPrice, max: maxPrice },
      stockSummary: totalStock,
      variantCount: productFamily.variants.length,
      isDeleted: false,
      updatedAt: new Date(),
    };

    if (!productDoc) {
      const res = await Product.insertOne({
        ...productPayload,
        createdAt: new Date(),
      });
      productDoc = await Product.findOne({ _id: res.insertedId });
      console.log(
        `\n🏷️ Created Product: ${productFamily.title.ar} (${productFamily.slug})`,
      );
    } else {
      await Product.updateOne(
        { _id: productDoc._id },
        { $set: productPayload },
      );
      console.log(
        `\n🔄 Updated Product: ${productFamily.title.ar} (${productFamily.slug})`,
      );
    }

    for (const variant of productFamily.variants) {
      const variantPayload = {
        productId: productDoc!._id,
        sku: variant.sku.toUpperCase().trim(),
        label: `${variant.label.ar} (${variant.label.en})`,
        price: variant.price,
        stock: variant.stock,
        attributes: variant.attributes,
        shippingProfile: variant.shippingProfile,
        components: variant.components || [],
        isActive: true,
        isDeleted: false,
        updatedAt: new Date(),
      };

      const existingVariant = await ProductVariant.findOne({
        sku: variantPayload.sku,
      });

      if (existingVariant) {
        await ProductVariant.updateOne(
          { _id: existingVariant._id },
          { $set: variantPayload },
        );
      } else {
        await ProductVariant.insertOne({
          ...variantPayload,
          reserved: 0,
          sold: 0,
          createdAt: new Date(),
        });
      }
      totalVariantsSeeded++;
    }

    console.log(
      `   └─ Seeded ${productFamily.variants.length} variants for SKU family: ${productFamily.variants[0]?.sku.substring(0, 7)}`,
    );
  }

  console.log(`\n🎉 Full Catalog Seeding Finished Successfully!`);
  console.log(`   Total Brands: ${FULL_CATALOG_BRANDS.length}`);
  console.log(`   Total Categories: ${FULL_CATALOG_CATEGORIES.length}`);
  console.log(`   Total Products Seeded: ${FULL_CATALOG_PRODUCTS.length}`);
  console.log(`   Total Variants Seeded: ${totalVariantsSeeded}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error during full catalog seeding:', err);
  process.exit(1);
});
