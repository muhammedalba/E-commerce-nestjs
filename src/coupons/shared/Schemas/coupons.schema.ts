import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import slugify from 'slugify';
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
  name!: string;

  @Prop({
    type: String,

    unique: true,
    minlength: 3,
    maxlength: 20,
    trim: true,
  })
  slug?: string; // Slug can be added later if needed

  @Prop({ required: true, enum: ['percentage', 'fixed'] })
  type!: 'percentage' | 'fixed';

  @Prop({ type: String, default: 'all' })
  applyTo?: 'all' | 'products' | 'categories' | 'brands';

  @Prop({ type: [String], default: undefined })
  applyItems?: string[];

  @Prop({ type: Date, required: true })
  expires!: Date;

  @Prop({ type: Number, required: true, min: 1, max: 1000 })
  discount!: number;

  @Prop({ default: true })
  active?: boolean;

  @Prop({ type: Number, default: 0, min: 0 })
  usageCount?: number;

  @Prop({ type: Number, default: 0, min: 0 })
  maxUsage?: number;

  @Prop({ type: Number, default: 0, min: 0 })
  minOrderAmount?: number;

  @Prop({ type: Number, default: 0, min: 0 })
  maxOrderAmount?: number;

  @Prop({ type: [String], default: [] })
  usedByUsers?: string[]; // Array of user IDs who have used the coupon
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
export type CouponDocument = HydratedDocument<Coupon>;

CouponSchema.pre('save', function (next) {
  if (this.isModified('name') && this.name) {
    const baseSlug = slugify(this.name.trim(), { lower: true, strict: true });
    this.slug = baseSlug;
  }
  next();
});
CouponSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update && '$set' in update) {
    if (update?.$set?.name) {
      const name: string = String(update.$set.name);
      const baseSlug = slugify(name.trim(), { lower: true, strict: true });
      update.slug = baseSlug;
      this.setUpdate(update);
    }
  }

  next();
});
