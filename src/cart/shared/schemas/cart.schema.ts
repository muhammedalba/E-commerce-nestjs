import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CartItem, CartItemSchema } from './cart-item.schema';
import { User } from 'src/auth/shared/schema/user.schema';

@Schema({ timestamps: true })
export class Cart extends Document {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true })
  user!: Types.ObjectId;

  @Prop({ type: [CartItemSchema], default: [] })
  items!: CartItem[];

  @Prop({ default: 0 })
  totalPrice!: number;

  @Prop({ default: 0 })
  totalQuantity!: number;

  @Prop({ default: false })
  isCheckedOut!: boolean;

  @Prop({ default: false })
  isSavedForLater!: boolean;
}

export const CartSchema = SchemaFactory.createForClass(Cart);
