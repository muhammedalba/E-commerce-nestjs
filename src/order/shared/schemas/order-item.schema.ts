import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

@Schema({ _id: false }) // nested schema
export class OrderItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.PRODUCT,
    required: true,
  })
  declare productId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.PRODUCT_VARIANT,
    required: true,
  })
  declare variantId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  declare quantity: number;

  @Prop({ type: Number, required: true })
  declare totalPrice: number;

  @Prop({ type: Number, required: true })
  declare price: number;

  @Prop({ type: Number, required: true, default: 0 })
  declare weight: number;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.BRAND,
    required: false,
  })
  declare brand: Types.ObjectId | string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.CATEGORY,
    required: false,
  })
  declare category: Types.ObjectId | string;

  // Snapshot of SKU at order time
  @Prop({ type: String })
  declare sku: string;

  // Snapshot of variant attributes at order time
  @Prop({ type: Object })
  declare attributes: Record<string, unknown>;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
