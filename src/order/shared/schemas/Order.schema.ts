import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { OrderItem, OrderItemSchema } from './order-item.schema';
import { OrderAddress, OrderAddressSchema } from './order-adress.schema';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentStatus } from 'src/payments/shared/enums/payment-status.enum';

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({
    required: false,
    type: 'string',
    trim: true,
  })
  declare transferReceiptImg: string;

  @Prop({
    required: false,
    type: 'string',
    trim: true,
  })
  declare InvoicePdf: string;

  @Prop({
    required: false,
    type: 'string',
    trim: true,
  })
  declare DeliveryReceiptImage: string;

  @Prop({
    required: false,
    type: 'string',
    trim: true,
  })
  declare deliveryReceiptNumber: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.USER,
    required: true,
  })
  declare user: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], default: [] })
  declare items: OrderItem[];

  @Prop({ default: 0 })
  declare totalPrice: number;

  @Prop({ default: 0 })
  declare totalQuantity: number;

  @Prop({ default: false })
  declare isCheckedOut: boolean;

  @Prop({ default: false })
  declare isSavedForLater: boolean;

  // --- Legacy Fields (Replaced by paymentMethodId and shippingProviderId) ---
  @Prop({ type: String, required: false })
  declare paymentMethod: string;

  @Prop({ type: String, required: false })
  declare shippingMethod: string;
  // --------------------------------------------------------------------------

  @Prop({ type: OrderAddressSchema, required: true })
  declare shippingAddress: OrderAddress;

  // --- New Enterprise Commerce Fields ---
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.SHIPPING_PROVIDER,
  })
  declare shippingProviderId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.SHIPPING_RATE })
  declare shippingRateId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.PAYMENT_METHOD,
    required: false,
  })
  declare paymentMethodId: Types.ObjectId;

  // Gateway code for settings-based methods (stripe, paypal, banktransfer, cod)
  @Prop({ type: String, required: false })
  declare paymentMethodCode: string;

  @Prop({ default: 0 })
  declare shippingAmount: number;

  @Prop({ default: 0 })
  declare taxAmount: number;

  @Prop({ default: 0 })
  declare paymentFees: number;

  @Prop({ default: 0 })
  declare grandTotal: number; // final amount paid by user

  @Prop({ default: 'SAR' })
  declare currency: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.COUPON,
    default: undefined,
  })
  declare couponId: Types.ObjectId;

  @Prop({ type: String, default: undefined })
  declare couponCode: string;

  @Prop({ type: Number, default: 0 })
  declare discountAmount: number;

  @Prop({ type: String, default: OrderStatus.PENDING })
  declare status: OrderStatus;

  @Prop({ type: String, default: undefined })
  declare paymentStatus: PaymentStatus;

  @Prop({ type: Date, default: undefined })
  declare completedAt: Date;

  @Prop({ type: Date, default: undefined })
  declare cancelledAt: Date;

  @Prop({ type: Date, default: undefined })
  declare processingAt: Date;

  @Prop({ type: Date, default: undefined })
  declare shippedAt: Date;

  @Prop({ type: Date, default: undefined })
  declare deliveredAt: Date;

  @Prop({ type: Date, default: undefined })
  declare paidAt: Date;

  @Prop({ type: Date, default: undefined })
  declare checkedOutAt: Date;

  @Prop({ type: Date, default: undefined })
  declare createdAt: Date;

  @Prop({ type: Date, default: undefined })
  declare updatedAt: Date;

  @Prop({ type: String, default: undefined })
  declare deliveryDate: string;

  @Prop({ type: Date, default: undefined })
  declare deletedAt: Date;

  @Prop({ type: Boolean, default: false })
  declare isDeleted: boolean;

  // رقم الفاتورة التسلسلي — يزداد تلقائياً مع كل طلب
  @Prop({ type: Number })
  declare invoiceNumber: number;

  @Prop({ type: String, default: undefined })
  declare notes: string;

  @Prop({ type: String, default: undefined })
  declare deliveryName: string;

  @Prop({ type: String, default: undefined })
  declare customerServiceContact: string;

  @Prop({ type: String, default: undefined })
  declare DeliveryVerificationCode: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// الزيادة التلقائية لرقم الفاتورة بشكل حتمي وآمن للطلبات المتزامنة تلقائياً
OrderSchema.pre('save', async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    const countersCollection = this.db.collection<{ _id: string; seq: number }>(
      'counters',
    );
    const counter = await countersCollection.findOneAndUpdate(
      { _id: 'invoiceNumber' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );

    const seq = (counter as { seq?: number } | null)?.seq ?? 1;
    this.invoiceNumber = seq;
  }
  next();
});
