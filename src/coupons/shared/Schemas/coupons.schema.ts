import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// 1. تحديد الـ Schema على شكل Class باستخدام الـ Decorators من @nestjs/mongoose
@Schema({ timestamps: true })
export class Coupon {
  @Prop({
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 20,
  })
  name!: string;

  @Prop({ type: Date, required: true })
  expires!: Date;

  @Prop({ type: Number, required: true, min: 1, max: 100 })
  discount!: number;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
export type CouponDocument = HydratedDocument<Coupon>;
