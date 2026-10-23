import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import type { InvoiceSnapshot } from '../invoice-data.builder';
import type { InvoiceStatus } from './invoice.schema';

/** A returned order line: which line (its index on the order) and how many. */
export interface CreditNoteLine {
  itemIndex: number;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
}

/** The credit note's amounts, in the store currency (all positive). */
export interface CreditNoteAmounts {
  /** Returned lines at their invoice price. */
  products: number;
  /** Their share of the order's coupon discount. */
  discount: number;
  /** Products after discount, excluding / including VAT. */
  productsBeforeTax: number;
  productsAfterTax: number;
  shipping: number;
  paymentFees: number;
  /** VAT on shipping and payment fees (applyTaxOnCharges); older notes: none. */
  chargesTax?: number;
  /** Total excluding VAT. */
  taxable: number;
  tax: number;
  total: number;
}

/**
 * Kept back from the money refunded, not from the credit note: a return for
 * other reasons than a defect pays its return shipping (with its VAT when
 * applyTaxOnCharges).
 */
export interface CreditNoteDeductions {
  returnShipping?: { amount: number; tax: number; total: number };
}

/**
 * - `awaiting_refund`: lines reserved while the money is refunded (Moyasar)
 * - `issued`: numbered and final (its PDF follows: `status`)
 * - `void`: the refund failed; frees its lines and never got a number
 */
export type CreditNoteState = 'awaiting_refund' | 'issued' | 'void';

/**
 * A tax credit note (مرتجع ضريبي) against an order's issued invoice: the
 * returned lines and their amounts, frozen like the invoice, with its own
 * number (RUH-R-8-{year}-{serial}).
 */
@Schema({ timestamps: true })
export class CreditNote {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.ORDER,
    required: true,
    index: true,
  })
  declare order: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Invoice', required: true })
  declare invoice: Types.ObjectId;

  @Prop({ type: String, enum: ['awaiting_refund', 'issued', 'void'] })
  declare state: CreditNoteState;

  // Taken from the `creditNoteNumber` counter only once issued: no gaps
  @Prop({ type: Number })
  declare creditNoteNumber?: number;

  @Prop({ type: String })
  declare displayNumber: string;

  @Prop({ type: Date })
  declare issuedAt?: Date;

  @Prop({ type: [Object], required: true })
  declare lines: CreditNoteLine[];

  // Shipping and payment fees: on the credit note that returns the last lines
  @Prop({ type: Boolean, default: false })
  declare includesCharges: boolean;

  @Prop({ type: Object, required: true })
  declare amounts: CreditNoteAmounts;

  @Prop({ type: String, required: true })
  declare reason: string;

  // Who pays the shipping: the store (defect) or the customer (other).
  // Older credit notes have none: priced as defect.
  @Prop({ type: String, enum: ['defect', 'other'] })
  declare reasonType?: 'defect' | 'other';

  @Prop({ type: Object, default: {} })
  declare deductions: CreditNoteDeductions;

  // The customer's return request it settles, if any
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ReturnRequest' })
  declare returnRequest?: Types.ObjectId;

  @Prop({ type: String, enum: ['admin', 'full_refund'], required: true })
  declare source: 'admin' | 'full_refund';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.USER })
  declare createdBy?: Types.ObjectId;

  // How the money went back: through Moyasar now, by hand (COD/transfer),
  // or it had been refunded already (Moyasar dashboard, refund dialog)
  @Prop({ type: Object })
  declare refund?: {
    via: 'moyasar' | 'manual' | 'already_refunded' | 'none';
    amount: number;
  };

  @Prop({ type: Boolean, default: false })
  declare restock: boolean;

  @Prop({ type: Boolean, default: false })
  declare restocked: boolean;

  // e.g. "full:<transactionId>": a replayed webhook never issues a second one
  @Prop({ type: String, unique: true, sparse: true })
  declare idempotencyKey?: string;

  @Prop({ type: String })
  declare voidReason?: string;

  // ── PDF, as on the invoice ──
  @Prop({ type: Object })
  declare snapshot?: InvoiceSnapshot;

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

  @Prop({ type: String })
  declare lockId?: string;

  @Prop({ type: Date })
  declare lockedUntil?: Date;

  @Prop({ type: Object })
  declare customerEmail?: {
    status: 'smtp_accepted' | 'smtp_accepted_without_invoice';
    acceptedAt: Date;
    messageId?: string;
  };
}

export type CreditNoteDocument = HydratedDocument<CreditNote>;
export const CreditNoteSchema = SchemaFactory.createForClass(CreditNote);

// The dashboard list (issued, newest first)
CreditNoteSchema.index({ state: 1, issuedAt: -1 });
