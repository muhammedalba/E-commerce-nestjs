import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';
import { Brand } from 'src/brands/shared/schemas/brand.schema';
import { Category } from 'src/categories/shared/schemas/category.schema';
import { SupCategory } from 'src/sup-category/shared/schemas/sup-category.schema';
import { Supplier } from 'src/supplier/shared/schema/Supplier.schema';
import { ProductVariant } from './ProductVariant.schema';

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Product {
  // ─── Localized Fields ──────────────────────────────────
  @Prop({
    type: Object,
    i18n: true,
    trim: true,
    required: [true, 'product title required'],
    minlength: 3,
    maxlength: 70,
  })
  title!: string | { en: string; ar: string };

  @Prop({
    type: String,
    required: true,
    lowercase: true,
  })
  slug!: string;

  @Prop({
    type: Object,
    i18n: true,
    trim: true,
    required: [true, 'product description required'],
    minlength: 15,
    maxlength: 2000,
  })
  description!: string | { en?: string; ar?: string };

  // ─── Media ─────────────────────────────────────────────
  @Prop({
    type: String,
    required: [true, 'product imageCover is required'],
  })
  imageCover!: string;

  @Prop({
    type: [String],
  })
  images?: string[];

  @Prop({
    type: String,
  })
  infoProductPdf?: string;

  // ─── Classification ────────────────────────────────────
  @Prop({
    type: Types.ObjectId,
    ref: Category.name,
    required: false,
  })
  category?: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: SupCategory.name, required: true }],
  })
  supCategories!: Types.ObjectId[];

  @Prop({
    type: Types.ObjectId,
    ref: Brand.name,
    required: false,
  })
  brand?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: Supplier.name,
    required: false,
  })
  supplier?: Types.ObjectId;

  // ─── Flags ─────────────────────────────────────────────
  @Prop({
    type: Boolean,
    default: true,
  })
  isUnlimitedStock!: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  disabled!: boolean;

  @Prop({
    type: Boolean,
    default: false,
    required: false,
  })
  isFeatured?: boolean;

  // ─── Ratings (aggregated, computed from reviews) ───────
  @Prop({
    type: Number,
    min: 1,
    max: 5,
    default: 1,
  })
  rating?: number;

  @Prop({
    type: Number,
    default: 0,
  })
  ratingsQuantity?: number;

  @Prop({
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  })
  ratingsAverage!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  totalSold!: number;

  // ─── Attribute Versioning & Definitions ────────────────
  @Prop({ type: Number, default: 1 })
  allowedAttributesVersion!: number;

  @Prop({ type: [Object], default: [] })
  allowedAttributes!: Array<{
    name: string;
    type: 'string' | 'number';
    required?: boolean;
    obsolete?: boolean;
    migratedTo?: string;
    allowedUnits?: string[];
    allowedValues?: string[];
  }>;

  // ─── Aggregated Variant Statistics ───────────────────────
  @Prop({ type: Object, default: { min: 0, max: 0 } })
  priceRange!: { min: number; max: number };

  @Prop({ type: Number, default: 0 })
  stockSummary!: number;

  @Prop({ type: Number, default: 0 })
  variantCount!: number;

  // ─── Soft Delete ───────────────────────────────────────
  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  isDeleted!: boolean;

  @Prop({
    type: Date,
    default: null,
  })
  deletedAt?: Date;

  // ─── Virtuals (TypeScript types) ────────────────────────
  variants?: ProductVariant[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.virtual('variants', {
  ref: 'ProductVariant',
  localField: '_id',
  foreignField: 'productId',
});
export type ProductDocument = HydratedDocument<Product>;

// ─── Indexes ─────────────────────────────────────────────
ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ category: 1, 'priceRange.min': 1 }); // Enhanced compound filter
ProductSchema.index({ brand: 1 });
ProductSchema.index({ supplier: 1 });
ProductSchema.index({ isDeleted: 1, disabled: 1 });


// ─── Auto-exclude soft-deleted documents ─────────────────
ProductSchema.pre('find', function () {
  if (!this.getFilter().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

ProductSchema.pre('findOne', function () {
  if (!this.getFilter().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

ProductSchema.pre('countDocuments', function () {
  if (!this.getFilter().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

// ─── URL Prefix for Media Fields ─────────────────────────
ProductSchema.post('init', function (doc: HydratedDocument<Product>) {
  const hasTranslatedDescription =
    doc?.title &&
    typeof doc.title === 'object' &&
    Object.values(doc.title).some(
      (value) => typeof value === 'string' && value.trim() !== '',
    );

  const baseUrl = process.env.BASE_URL ?? '';

  if (hasTranslatedDescription) {
    ['imageCover', 'infoProductPdf'].forEach((key) => {
      const path = doc[key as keyof Product];
      if (typeof path === 'string' && !path.startsWith(baseUrl)) {
        doc[key] = `${baseUrl}${path}`;
      }
    });
    const paths = doc?.images?.map((key) => `${baseUrl}${key}`);
    doc.images = paths;
  }
});
