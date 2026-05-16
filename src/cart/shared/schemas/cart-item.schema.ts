import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

@Schema({ _id: false }) // nested schema
export class CartItem {
  @Prop({ type: Types.ObjectId, ref: MODEL_NAMES.PRODUCT, required: true })
  declare product: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: MODEL_NAMES.PRODUCT_VARIANT, required: true })
  declare variant: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  declare quantity: number;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);
