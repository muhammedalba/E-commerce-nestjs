import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CartItem, CartItemSchema } from './cart-item.schema';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

@Schema({ timestamps: true })
export class Cart extends Document {
  @Prop({ type: Types.ObjectId, ref: MODEL_NAMES.USER, required: true, unique: true })
  declare user: Types.ObjectId;

  @Prop({ type: [CartItemSchema], default: [] })
  declare items: CartItem[];

  @Prop({ default: 0 })
  declare totalPrice: number;

  @Prop({ default: 0 })
  declare totalQuantity: number;

  @Prop({ default: false })
  declare isCheckedOut: boolean;

  @Prop({ default: false })
  declare isSavedForLater: boolean;
}

export const CartSchema = SchemaFactory.createForClass(Cart);
