import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderItem, OrderItemSchema } from './order-item.schema';
import { User } from 'src/auth/shared/schema/user.schema';
import { OrderAddress, OrderAddressSchema } from './order-adress.schema';
import { ShippingProvider } from 'src/shipping/shared/schema/shipping-provider.schema';
import { ShippingRate } from 'src/shipping/shared/schema/shipping-rate.schema';
import { PaymentMethod as NewPaymentMethod } from 'src/payments/shared/schema/payment-method.schema';

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

  // --- Legacy Fields (Replaced by paymentMethodId and shippingProviderId) ---
  @Prop({ type: String, required: false })
  paymentMethod?: string;

  @Prop({ type: String, required: false })
  shippingMethod?: string;
  // --------------------------------------------------------------------------

  @Prop({ type: OrderAddressSchema, required: true })
  shippingAddress!: OrderAddress;

  // --- New Enterprise Commerce Fields ---
  @Prop({ type: Types.ObjectId, ref: 'ShippingProvider' })
  shippingProviderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ShippingRate' })
  shippingRateId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PaymentMethod' })
  paymentMethodId?: Types.ObjectId;

  @Prop({ default: 0 })
  shippingAmount!: number;

  @Prop({ default: 0 })
  taxAmount!: number;

  @Prop({ default: 0 })
  paymentFees!: number;

  @Prop({ default: 0 })
  grandTotal!: number; // final amount paid by user

  @Prop({ default: 'SAR' })
  currency!: string;

  @Prop({ type: Object })
  checkoutSummary?: any; // Snapshot of the checkout calculation summary
  // --------------------------------------

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
  createdAt?: Date;

  @Prop({ type: Date, default: undefined })
  updatedAt?: Date;

  @Prop({ type: Date, default: undefined })
  deletedAt?: Date;

  @Prop({ type: Boolean, default: false })
  isDeleted?: boolean;

  @Prop({ type: String, default: undefined })
  notes?: string; // Additional notes for the order

  // @Prop({ type: String, default: undefined })
  // LocationOnMap?: string; // Optional field for storing location on map

  @Prop({ type: String, default: undefined })
  deliveryDate?: string; // Optional field for estimated delivery date

  @Prop({ type: String, default: undefined })
  deliveryName?: string;

  @Prop({ type: String, default: undefined })
  customerServiceContact?: string; // Optional field for customer service contact information

  @Prop({ type: String, default: undefined })
  paymentStatus?: 'paid' | 'pending' | 'failed';

  @Prop({ type: String, default: undefined })
  DeliveryVerificationCode?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
