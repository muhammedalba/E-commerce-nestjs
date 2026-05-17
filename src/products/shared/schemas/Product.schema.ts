import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, IsOptional, ValidateNested } from 'class-validator';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { ProductVariant } from './ProductVariant.schema';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import {
  FieldLocalizeDto,
  ArrayLocalizeDto,
} from 'src/shared/utils/field-locolaized.dto';

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Product {
  // ─── Localized Fields ──────────────────────────────────
  @Prop({
    type: Object,
    required: true,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  declare title: FieldLocalizeDto;

  @Prop({
    type: String,
    required: true,
    lowercase: true,
  })
  declare slug: string;

  @Prop({
    type: Object,
    required: true,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  declare description: FieldLocalizeDto;

  @Prop({
    type: Object,
    required: false,
    default: { en: [], ar: [] },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ArrayLocalizeDto)
  declare uses: ArrayLocalizeDto | undefined;

  // ─── Media ─────────────────────────────────────────────
  @Prop({
    type: String,
    required: [true, 'product imageCover is required'],
  })
  declare imageCover: string;

  @Prop({
    type: [String],
  })
  declare images: string[] | undefined;

  @Prop({
    type: String,
  })
  declare infoProductPdf: string | undefined;

  // ─── Classification ────────────────────────────────────
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.CATEGORY,
    required: false,
  })
  declare category: Types.ObjectId | undefined;

  @Prop({
    type: [
      {
        type: MongooseSchema.Types.ObjectId,
        ref: MODEL_NAMES.SUB_CATEGORY,
        required: true,
      },
    ],
  })
  declare SubCategories: Types.ObjectId[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.BRAND,
    required: false,
  })
  declare brand: Types.ObjectId | undefined;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.SUPPLIER,
    required: false,
  })
  declare supplier: Types.ObjectId | undefined;

  // ─── Flags ─────────────────────────────────────────────
  @Prop({
    type: Boolean,
    default: true,
  })
  declare isUnlimitedStock: boolean;

  @Prop({
    type: Boolean,
    default: true,
    required: false,
  })
  declare isActive: boolean;

  @Prop({
    type: Boolean,
    default: false,
    required: false,
  })
  declare isFeatured: boolean | undefined;

  // ─── Ratings (aggregated, computed from reviews) ───────
  @Prop({
    type: Number,
    min: 1,
    max: 5,
    default: 1,
  })
  declare rating: number | undefined;

  @Prop({
    type: Number,
    default: 0,
  })
  declare ratingsQuantity: number | undefined;

  @Prop({
    type: Number,
    min: 0,
    max: 5,
    default: 2,
  })
  declare ratingsAverage: number;

  @Prop({
    type: Number,
    default: 0,
  })
  declare totalSold: number;

  // ─── Attribute Versioning & Definitions ────────────────
  @Prop({ type: Number, default: 1 })
  declare allowedAttributesVersion: number;

  @Prop({ type: [Object], default: [] })
  declare allowedAttributes: Array<{
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
  declare priceRange: { min: number; max: number };

  @Prop({ type: Number, default: 0 })
  declare stockSummary: number;

  @Prop({ type: Number, default: 0 })
  declare variantCount: number;

  // ─── Soft Delete ───────────────────────────────────────
  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  declare isDeleted: boolean;

  @Prop({
    type: Date,
    default: null,
  })
  declare deletedAt: Date | undefined;

  // ─── Virtuals (TypeScript types) ────────────────────────
  declare variants: ProductVariant[] | undefined;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.virtual('variants', {
  ref: MODEL_NAMES.PRODUCT_VARIANT,
  localField: '_id',
  foreignField: 'productId',
});
export type ProductDocument = HydratedDocument<Product>;

// ─── Indexes ─────────────────────────────────────────────
ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ category: 1, 'priceRange.min': 1 }); // Enhanced compound filter
ProductSchema.index({ brand: 1 });
ProductSchema.index({ supplier: 1 });
ProductSchema.index({ isDeleted: 1, isActive: 1, isFeatured: 1 });
ProductSchema.index({ 'priceRange.min': 1 });

// ─── Auto-exclude soft-deleted documents ─────────────────
ProductSchema.pre('find', function () {
  if (!this.getFilter().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
  if (this.getFilter().isActive === undefined) {
    this.where({ isActive: { $ne: false } });
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
// ProductSchema.post('init', function (doc: HydratedDocument<Product>) {
//   const hasTranslatedDescription =
//     doc?.title &&
//     typeof doc.title === 'object' &&
//     Object.values(doc.title).some(
//       (value) => typeof value === 'string' && value.trim() !== '',
//     );

//   const baseUrl = process.env.BASE_URL ?? '';

//   if (hasTranslatedDescription) {
//     ['imageCover', 'infoProductPdf'].forEach((key) => {
//       const path = doc[key as keyof Product];
//       if (typeof path === 'string' && !path.startsWith(baseUrl)) {
//         doc[key] = `${baseUrl}${path}`;
//       }
//     });
//     const paths = doc?.images?.map((key) => `${baseUrl}${key}`);
//     doc.images = paths;
//   }
// });
