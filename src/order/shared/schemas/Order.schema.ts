import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderItem, OrderItemSchema } from './order-item.schema';
import { User } from 'src/auth/shared/schema/user.schema';
import { OrderAddress, OrderAddressSchema } from './order-adress.schema';

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({
    required: false,
    type: 'string',
    trim: true,
  })
  transferReceiptImg!: string;

  @Prop({
    required: false,
    type: 'string',
    trim: true,
  })
  InvoicePdf?: string;

  @Prop({
    required: false,
    type: 'string',
    trim: true,
  })
  DeliveryReceiptImage?: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user!: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], default: [] })
  items!: OrderItem[];

  @Prop({ default: 0 })
  totalPrice!: number;

  @Prop({ default: 0 })
  totalQuantity!: number;

  @Prop({ default: false })
  isCheckedOut!: boolean;

  @Prop({ default: false })
  isSavedForLater!: boolean;

  @Prop({ type: String, default: 'pending' })
  status!: 'pending' | 'processing' | 'completed' | 'cancelled';

  @Prop({ type: String, default: 'cash' })
  paymentMethod!: 'cash' | 'creditCard' | 'paypal';

  @Prop({ type: String, default: 'default' })
  shippingMethod!: 'default' | 'express' | 'pickup';

  @Prop({ type: OrderAddressSchema, required: true })
  shippingAddress!: OrderAddress; // Array of strings to store address lines

  @Prop({ type: String, default: undefined })
  couponCode?: string;

  @Prop({ type: Number, default: 0 })
  discountAmount!: number;

  @Prop({ type: Date, default: undefined })
  completedAt?: Date;

  @Prop({ type: Date, default: undefined })
  cancelledAt?: Date;

  @Prop({ type: Date, default: undefined })
  processingAt?: Date;

  @Prop({ type: Date, default: undefined })
  checkedOutAt?: Date;

  @Prop({ type: Date, default: undefined })
  savedForLaterAt?: Date;

  @Prop({ type: Date, default: undefined })
  createdAt?: Date;

  @Prop({ type: Date, default: undefined })
  updatedAt?: Date;

  @Prop({ type: Date, default: undefined })
  deletedAt?: Date;

  @Prop({ type: Boolean, default: false })
  isDeleted?: boolean;

  @Prop({ type: String, default: undefined })
  notes?: string; // Additional notes for the order

  @Prop({ type: String, default: undefined })
  LocationOnMap?: string; // Optional field for storing location on map

  @Prop({ type: String, default: undefined })
  deliveryDate?: string; // Optional field for estimated delivery date

  @Prop({ type: String, default: undefined })
  deliveryName?: string;

  @Prop({ type: String, default: undefined })
  customerServiceContact?: string; // Optional field for customer service contact information

  @Prop({ type: String, default: undefined })
  paymentStatus?: string; // Optional field for payment status (e.g., paid, pending, failed)

  @Prop({ type: String, default: undefined })
  DeliveryVerificationCode?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
