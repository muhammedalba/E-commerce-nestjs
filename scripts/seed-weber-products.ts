import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import {
  WEBER_CATEGORIES,
  WEBER_PRODUCTS_DATA,
} from '../src/seed/weber-products-data';

// Run with: npx tsx scripts/seed-weber-products.ts

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

  // 1. Find or Create Brand: Weber Sodamco
  let brand = await Brand.findOne({ slug: 'weber-sodamco' });
  if (!brand) {
    const res = await Brand.insertOne({
      name: { ar: 'سودامكو ويبر', en: 'Weber Sodamco' },
      slug: 'weber-sodamco',
      image: {
        url: '/uploads/brands/weber.png',
        publicId: 'weber-brand-default',
        provider: 'local',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    brand = await Brand.findOne({ _id: res.insertedId });
    console.log('📦 Created Brand: Weber Sodamco');
  } else {
    console.log('ℹ️ Found existing Brand: Weber Sodamco');
  }

  // 2. Seed Categories & SubCategories
  const subCategoryMap = new Map<
    string,
    {
      categoryId: mongoose.Types.ObjectId;
      subCategoryId: mongoose.Types.ObjectId;
    }
  >();

  for (const catData of WEBER_CATEGORIES) {
    let category = await Category.findOne({ slug: catData.slug });
    if (!category) {
      const res = await Category.insertOne({
        name: catData.name,
        slug: catData.slug,
        image: {
          url: '/uploads/categories/default.png',
          publicId: 'default-category',
          provider: 'local',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      category = await Category.findOne({ _id: res.insertedId });
      console.log(`📁 Created Category: ${catData.name.ar} (${catData.slug})`);
    } else {
      console.log(`ℹ️ Found existing Category: ${catData.name.ar}`);
    }

    for (const subCatData of catData.subCategories) {
      let subCategory = await SubCategory.findOne({ slug: subCatData.slug });
      if (!subCategory) {
        const res = await SubCategory.insertOne({
          name: subCatData.name,
          slug: subCatData.slug,
          category: category!._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        subCategory = await SubCategory.findOne({ _id: res.insertedId });
        console.log(
          `  📂 Created SubCategory: ${subCatData.name.ar} (${subCatData.slug})`,
        );
      } else {
        console.log(`  ℹ️ Found existing SubCategory: ${subCatData.name.ar}`);
      }

      subCategoryMap.set(subCatData.slug, {
        categoryId: category!._id as mongoose.Types.ObjectId,
        subCategoryId: subCategory!._id as mongoose.Types.ObjectId,
      });
    }
  }

  // 3. Seed Products and Variants
  console.log(`\n🚀 Seeding ${WEBER_PRODUCTS_DATA.length} Product Families...`);

  let totalVariantsSeeded = 0;

  for (const productFamily of WEBER_PRODUCTS_DATA) {
    const classification = subCategoryMap.get(productFamily.subCategorySlug);
    if (!classification) {
      console.warn(
        `⚠️ Warning: Subcategory not found for slug: ${productFamily.subCategorySlug}`,
      );
      continue;
    }

    const { categoryId, subCategoryId } = classification;

    // Calculate aggregated prices and stocks
    const prices = productFamily.variants.map((v) => v.price);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const totalStock = productFamily.variants.reduce(
      (sum, v) => sum + v.stock,
      0,
    );

    // Upsert Parent Product
    let product = await Product.findOne({ slug: productFamily.slug });
    const productPayload = {
      title: productFamily.title,
      slug: productFamily.slug,
      description: productFamily.description,
      category: categoryId,
      SubCategories: [subCategoryId],
      brand: brand!._id,
      allowedAttributes: productFamily.allowedAttributes,
      allowedAttributesVersion: 1,
      imageCover: {
        url: '/uploads/products/default.png',
        publicId: 'default-weber-cover',
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

    if (!product) {
      const res = await Product.insertOne({
        ...productPayload,
        createdAt: new Date(),
      });
      product = await Product.findOne({ _id: res.insertedId });
      console.log(
        `\n🏷️ Created Product: ${productFamily.title.ar} (${productFamily.slug})`,
      );
    } else {
      await Product.updateOne({ _id: product._id }, { $set: productPayload });
      console.log(
        `\n🔄 Updated Product: ${productFamily.title.ar} (${productFamily.slug})`,
      );
    }

    // Upsert Variants
    for (const variantData of productFamily.variants) {
      const variantPayload = {
        productId: product!._id,
        sku: variantData.sku.toUpperCase().trim(),
        label: `${variantData.label.ar} (${variantData.label.en})`,
        price: variantData.price,
        stock: variantData.stock,
        attributes: variantData.attributes,
        shippingProfile: variantData.shippingProfile,
        components: variantData.components || [],
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
      `   └─ Seeded ${productFamily.variants.length} variants for SKU family: ${productFamily.variants[0]?.sku.split('-')[0] || ''}`,
    );
  }

  console.log(`\n🎉 Weber Seeding Finished!`);
  console.log(`   Total Products: ${WEBER_PRODUCTS_DATA.length}`);
  console.log(`   Total Variants: ${totalVariantsSeeded}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error during Weber seeding:', err);
  process.exit(1);
});
