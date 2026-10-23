import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import type { ReturnReasonType } from 'src/invoice/credit-note.calculator';

/**
 * - `pending`: waiting for the admin
 * - `approved`: settled by a credit note (`creditNote`), money refunded
 * - `rejected`: the admin said no (`rejectionReason`)
 * - `cancelled`: withdrawn by the customer before a decision
 */
export type ReturnRequestStatus =
  'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * A customer's request to return items of an order, within the return
 * window (`returnWindowDays` in the store settings, after delivery). The admin approves it (which
 * issues the credit note and refunds) or rejects it. One pending request per
 * order at a time.
 */
@Schema({ timestamps: true })
export class ReturnRequest {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.ORDER,
    required: true,
    index: true,
  })
  declare order: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.USER,
    required: true,
  })
  declare user: Types.ObjectId;

  // The order lines (index on the order) and quantities asked for
  @Prop({ type: [Object], required: true })
  declare lines: { itemIndex: number; quantity: number }[];

  // defect: the store pays the shipping; other: the customer does
  @Prop({ type: String, enum: ['defect', 'other'], required: true })
  declare reasonType: ReturnReasonType;

  @Prop({ type: String, required: true, maxlength: 1000 })
  declare note: string;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true,
  })
  declare status: ReturnRequestStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.USER })
  declare decidedBy?: Types.ObjectId;

  @Prop({ type: Date })
  declare decidedAt?: Date;

  @Prop({ type: String, maxlength: 500 })
  declare rejectionReason?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'CreditNote' })
  declare creditNote?: Types.ObjectId;

  // Lease while an approval refunds: a second approval meanwhile is refused
  @Prop({ type: Date })
  declare processingUntil?: Date;

  declare createdAt?: Date;
  declare updatedAt?: Date;
}

export type ReturnRequestDocument = HydratedDocument<ReturnRequest>;
export const ReturnRequestSchema = SchemaFactory.createForClass(ReturnRequest);

// One pending request per order: a second one waits for the decision
ReturnRequestSchema.index(
  { order: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
