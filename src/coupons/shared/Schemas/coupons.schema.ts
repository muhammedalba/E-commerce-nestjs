import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Coupon {
  @Prop({
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 20,
    trim: true,
  })
  declare name: string;

  @Prop({
    type: String,

    unique: true,
    minlength: 3,
    maxlength: 20,
    trim: true,
  })
  declare slug: string; // Slug can be added later if needed

  @Prop({ required: true, enum: ['percentage', 'fixed'] })
  declare type: 'percentage' | 'fixed';

  @Prop({ type: String, default: 'all' })
  declare applyTo: 'all' | 'products' | 'categories' | 'brands';

  @Prop({ type: [String], default: undefined })
  declare applyItems: string[];

  @Prop({ type: Date, required: true })
  declare expires: Date;

  @Prop({ type: Number, required: true, min: 1, max: 1000 })
  declare discount: number;

  @Prop({ default: true })
  declare active: boolean;

  @Prop({ type: Number, default: 0, min: 0 })
  declare usageCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  declare maxUsage: number;

  @Prop({ type: Number, default: 0, min: 0 })
  declare minOrderAmount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  declare maxOrderAmount: number;

  @Prop({ type: [String], default: [] })
  declare usedByUsers: string[]; // Array of user IDs who have used the coupon
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
export type CouponDocument = HydratedDocument<Coupon>;

// ─── Auto-exclude soft-deleted documents ─────────────────
CouponSchema.pre(['find', 'countDocuments'], function () {
  if (this.getFilter().active === undefined) {
    this.where({ active: { $ne: false } });
  }
});
