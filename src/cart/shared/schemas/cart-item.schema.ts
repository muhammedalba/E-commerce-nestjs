import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Product } from 'src/products/shared/schemas/Product.schema';
import { ProductVariant } from 'src/products/shared/schemas/ProductVariant.schema';

@Schema({ _id: false }) // nested schema
export class CartItem {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  product!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: ProductVariant.name, required: true })
  variant!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity!: number;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);
