import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

@Schema({ _id: false }) // nested schema
export class CartItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.PRODUCT,
    required: true,
  })
  declare product: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.PRODUCT_VARIANT,
    required: true,
  })
  declare variant: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  declare quantity: number;

  /**
   * Price Snapshot: the unit price captured at the moment the item was added to the cart.
   * Stored to avoid N+1 queries (e.g., when removing items and recalculating totals).
   * Derived from `variant.priceAfterDiscount ?? variant.price` at add-time.
   */
  @Prop({ required: true, min: 0 })
  declare unitPrice: number;

  /**
   * Brand Snapshot: captured at add-time to support brand-restricted coupon validation
   * without requiring an extra product lookup at checkout.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.BRAND,
    required: false,
  })
  declare brand?: Types.ObjectId;

  /**
   * Category Snapshot: captured at add-time to support category-restricted coupon
   * validation without requiring an extra product lookup at checkout.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.CATEGORY,
    required: false,
  })
  declare category?: Types.ObjectId;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);
