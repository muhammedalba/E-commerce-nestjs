import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Product } from './Product.schema';

// ─── Valid Units Enum ────────────────────────────────────
export enum MeasurementUnit {
  KG = 'kg',
  LTR = 'ltr',
  ML = 'ml',
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
  name!: string; // e.g. "A", "B"

  @Prop({ type: Number, required: true })
  value!: number; // e.g. 20

  @Prop({
    type: String,
    required: true,
    lowercase: true,
    enum: Object.values(MeasurementUnit),
  })
  unit!: string; // e.g. "kg"
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
    type: Types.ObjectId,
    ref: Product.name,
    required: true,
    index: true,
  })
  productId!: Types.ObjectId;

  // ─── SKU & Barcode ─────────────────────────────────────
  @Prop({
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  })
  sku!: string;

  @Prop({
    type: String,
    trim: true,
  })
  barcode?: string;

  // ─── Pricing ───────────────────────────────────────────
  @Prop({
    type: Number,
    required: [true, 'variant price is required'],
    min: 0,
    max: 200000,
  })
  price!: number;

  @Prop({
    type: Number,
    min: 0,
    max: 200000,
  })
  priceAfterDiscount?: number;

  // ─── Stock ─────────────────────────────────────────────
  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  stock!: number;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  sold!: number;

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
  attributes!: Record<string, unknown>;

  // ─── Multi-Component Products (A+B) ────────────────────
  @Prop({
    type: [VariantComponentSchema],
    default: [],
  })
  components!: VariantComponent[];

  // ─── Variant Label (auto-generated or manual) ──────────
  // e.g. "20 KG + 4.8 LTR (A+B)" or "Red / 500ml"
  @Prop({
    type: String,
    trim: true,
  })
  label?: string;

  // ─── Variant-Specific Image (optional) ─────────────────
  @Prop({
    type: String,
  })
  image?: string;

  // ─── Status ────────────────────────────────────────────
  @Prop({
    type: Boolean,
    default: true,
  })
  isActive!: boolean;

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
  if (!this.getFilter().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

ProductVariantSchema.pre('findOne', function () {
  if (!this.getFilter().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

ProductVariantSchema.pre('countDocuments', function () {
  if (!this.getFilter().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});
