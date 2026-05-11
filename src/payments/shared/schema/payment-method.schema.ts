import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentMethodDocument = HydratedDocument<PaymentMethod>;

export enum PaymentType {
  CARD = 'card',
  WALLET = 'wallet',
  BANK_TRANSFER = 'bank_transfer',
  CASH = 'cash',
  BUY_NOW_PAY_LATER = 'bnpl',
}

@Schema({ timestamps: true })
export class PaymentMethod {
  @Prop({ required: true })
  declare name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  declare code: string;

  @Prop({ required: true, enum: PaymentType })
  declare type: PaymentType;

  @Prop({ default: true })
  declare isActive: boolean;

  @Prop({ default: 0 })
  declare fees: number;

  @Prop({ default: '' })
  declare icon: string;

  @Prop({ type: [String], default: ['SAR'] })
  declare supportedCurrencies: string[];

  @Prop({ default: 0 })
  declare displayOrder: number;

  @Prop({ default: false })
  declare requiresAdditionalInfo: boolean;
}

export const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);

PaymentMethodSchema.index({ isActive: 1, displayOrder: 1 });
