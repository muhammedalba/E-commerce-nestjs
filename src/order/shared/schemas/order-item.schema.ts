import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Product } from 'src/products/shared/schemas/Product.schema';
import { ProductVariant } from 'src/products/shared/schemas/ProductVariant.schema';

@Schema({ _id: false }) // nested schema
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  productId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: ProductVariant.name, required: true })
  variantId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ type: Number, required: true })
  totalPrice!: number;

  // Snapshot of SKU at order time
  @Prop({ type: String })
  sku?: string;

  // Snapshot of variant attributes at order time
  @Prop({ type: Object })
  attributes?: Record<string, unknown>;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
