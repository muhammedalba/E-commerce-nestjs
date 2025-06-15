import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Product } from 'src/products/shared/schemas/Product.schema';

@Schema({ _id: false }) // nested schema
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity!: number;
  @Prop({ type: Number, required: true })
  totalPrice!: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
