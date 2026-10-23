import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import type { InvoiceSnapshot } from '../invoice-data.builder';

/** Issuing state of the PDF only; the customer email is tracked apart. */
export type InvoiceStatus = 'pending' | 'generating' | 'generated' | 'failed';

/**
 * The tax invoice issued for an order: one per order (unique), with its data
 * frozen at issue time so a retry or a later render gives the same document.
 */
@Schema({ timestamps: true })
export class Invoice {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.ORDER,
    required: true,
    unique: true,
  })
  declare order: Types.ObjectId;

  // The order's serial, never a new one: a retry keeps the same number
  @Prop({ type: Number })
  declare invoiceNumber?: number;

  @Prop({ type: String, required: true })
  declare displayNumber: string;

  @Prop({ type: Date, required: true })
  declare issuedAt: Date;

  @Prop({ type: Object, required: true })
  declare snapshot: InvoiceSnapshot;

  @Prop({
    type: String,
    enum: ['pending', 'generating', 'generated', 'failed'],
    default: 'pending',
  })
  declare status: InvoiceStatus;

  @Prop({ type: Object })
  declare file?: FileAsset;

  @Prop({ type: String })
  declare fileSha256?: string;

  @Prop({ type: Number })
  declare fileSize?: number;

  @Prop({ type: Date })
  declare generatedAt?: Date;

  @Prop({ type: Number, default: 0 })
  declare attempts: number;

  @Prop({ type: String })
  declare lastError?: string;

  // Generation lease: only its holder may store the file
  @Prop({ type: String })
  declare lockId?: string;

  @Prop({ type: Date })
  declare lockedUntil?: Date;

  // Bumped inside every credit-note transaction of this invoice: two credit
  // notes for the same order then conflict instead of both returning a line
  @Prop({ type: Number, default: 0 })
  declare creditNoteSeq: number;

  // Customer confirmation email. "smtp_accepted" means the mail server took
  // the message, not that it reached the inbox.
  @Prop({ type: Object })
  declare customerEmail?: {
    status: 'smtp_accepted' | 'smtp_accepted_without_invoice';
    acceptedAt: Date;
    messageId?: string;
  };
}

export type InvoiceDocument = HydratedDocument<Invoice>;
export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

// The dashboard lists (newest first, by status)
InvoiceSchema.index({ issuedAt: -1 });
InvoiceSchema.index({ status: 1, issuedAt: -1 });
