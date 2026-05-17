import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

// ─── Valid Units Enum ────────────────────────────────────
export enum MeasurementUnit {
  KG = 'kg',
  G = 'g',
  LB = 'lb',
  OZ = 'oz',
  LTR = 'ltr',
  L = 'l',
  ML = 'ml',
  GAL = 'gal',
  MM = 'mm',
  CM = 'cm',
  M = 'm',
  PCS = 'pcs',
  BAG = 'bag',
  ROLL = 'roll',
}

// ─── Component Sub-Schema (for A+B products) ─────────────
@Schema({ _id: false })
export class VariantComponent {
  @Prop({ type: String, required: true, trim: true })
  declare name: string; // e.g. "A", "B"

  @Prop({ type: Number, required: true })
  declare value: number; // e.g. 20

  @Prop({
    type: String,
    required: true,
    lowercase: true,
    // enum: Object.values(MeasurementUnit),
  })
  declare unit: string; // e.g. "kg"
}

export const VariantComponentSchema =
  SchemaFactory.createForClass(VariantComponent);

// ─── Main Variant Schema ─────────────────────────────────
@Schema({
  timestamps: true,
  strict: true, // Only allow attributes inside the 'attributes' record
})
export class ProductVariant {
  // ─── Parent Reference ──────────────────────────────────
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.PRODUCT,
    required: true,
    index: true,
  })
  declare productId: Types.ObjectId;

  // ─── SKU & Barcode ─────────────────────────────────────
  @Prop({
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  })
  declare sku: string;

  @Prop({
    type: String,
    trim: true,
  })
  declare barcode: string | undefined;

  // ─── Pricing ───────────────────────────────────────────
  @Prop({
    type: Number,
    required: [true, 'variant price is required'],
    min: 0,
    max: 200000,
  })
  declare price: number;

  @Prop({
    type: Number,
    min: 0,
    max: 200000,
  })
  declare priceAfterDiscount: number | undefined;

  // ─── Stock ─────────────────────────────────────────────
  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  declare stock: number;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  declare sold: number;

  // ─── Dynamic Attributes ────────────────────────────────
  // Fully dynamic object. Examples:
  //   { color: "red" }
  //   { weight: { value: 20, unit: "kg" } }
  //   { volume: { value: 4.8, unit: "ltr" }, color: "white" }
  //   { length: { value: 100, unit: "cm" }, thickness: { value: 2, unit: "mm" } }
  @Prop({
    type: Object,
    default: {},
  })
  declare attributes: Record<string, unknown>;

  // ─── Multi-Component Products (A+B) ────────────────────
  @Prop({
    type: [VariantComponentSchema],
    default: [],
  })
  declare components: VariantComponent[];

  // ─── Variant Label (auto-generated or manual) ──────────
  // e.g. "20 KG + 4.8 LTR (A+B)" or "Red / 500ml"
  @Prop({
    type: String,
    trim: true,
  })
  declare label: string | undefined;

  // ─── Variant-Specific Image (optional) ─────────────────
  @Prop({
    type: String,
  })
  declare image: string | undefined;

  // ─── Status ────────────────────────────────────────────
  @Prop({
    type: Boolean,
    default: true,
  })
  declare isActive: boolean;

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
}

export const ProductVariantSchema =
  SchemaFactory.createForClass(ProductVariant);
export type ProductVariantDocument = HydratedDocument<ProductVariant>;

// ─── Indexes ─────────────────────────────────────────────
ProductVariantSchema.index({ productId: 1, isDeleted: 1 });
ProductVariantSchema.index({ sku: 1 }, { unique: true });
ProductVariantSchema.index({ barcode: 1 }, { sparse: true });
// Compound sorting index (price bounds)
ProductVariantSchema.index({ productId: 1, isActive: 1, price: 1 });
// Targeted global filter indexes (only for most common)
ProductVariantSchema.index({ 'attributes.color': 1, price: 1 });
// We INTENTIONALLY omit specific dynamic indexes (weight, volume) to prevent index explosion.

// ─── Auto-exclude soft-deleted variants ──────────────────
ProductVariantSchema.pre('find', function () {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
});

ProductVariantSchema.pre('findOne', function () {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
});

ProductVariantSchema.pre('countDocuments', function () {
  if (!this.getFilter().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});
