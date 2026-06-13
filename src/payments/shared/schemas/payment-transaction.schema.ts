import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

export type PaymentTransactionDocument = HydratedDocument<PaymentTransaction>;

@Schema({ timestamps: true })
export class PaymentTransaction {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.ORDER,
    required: true,
    index: true,
  })
  declare orderId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.USER,
    required: true,
    index: true,
  })
  declare userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(PaymentProvider),
    required: true,
  })
  declare provider: PaymentProvider;

  @Prop({
    type: String,
    unique: true,
    sparse: true,
    index: true,
  })
  declare providerPaymentId: string | undefined;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  declare amount: number;

  @Prop({
    type: String,
    required: true,
    default: 'SAR',
  })
  declare currency: string;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.INITIATED,
    index: true,
  })
  declare status: PaymentStatus;

  @Prop({
    type: String,
  })
  declare paymentUrl: string | undefined;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  declare metadata: Record<string, any>;

  @Prop({ type: Date })
  declare paidAt: Date | undefined;

  @Prop({ type: Date })
  declare failedAt: Date | undefined;
}

export const PaymentTransactionSchema =
  SchemaFactory.createForClass(PaymentTransaction);
