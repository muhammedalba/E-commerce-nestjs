import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  encryptConfigValues,
  decryptConfigValues,
} from '../utils/encryption.util';

export type PaymentMethodDocument = HydratedDocument<PaymentMethod>;

export enum PaymentType {
  CARD = 'card',
  WALLET = 'wallet',
  BANK_TRANSFER = 'bank_transfer',
  CASH_ON_DELIVERY = 'cash_on_delivery',
  BUY_NOW_PAY_LATER = 'bnpl',
  CUSTOM = 'custom',
}

export enum FeeType {
  FIXED = 'fixed',
  PERCENTAGE = 'percentage',
}

@Schema({ timestamps: true })
export class PaymentMethod {
  @Prop({ type: Object, required: true })
  declare name: { ar: string; en: string };

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  declare code: string;

  @Prop({ required: true, enum: PaymentType })
  declare type: PaymentType;

  @Prop({ required: true, enum: FeeType, default: FeeType.FIXED })
  declare feeType: FeeType;

  @Prop({ default: true })
  declare isActive: boolean;

  @Prop({ default: 0 })
  declare fixedFee: number;

  @Prop({ default: 0 })
  declare percentageFee: number;

  @Prop({ type: Object, default: { ar: '', en: '' } })
  declare description: { ar: string; en: string };

  @Prop({ required: true, type: String })
  declare provider: string;

  @Prop({ type: Object, default: {} })
  declare publicConfig: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  declare secretConfig: Record<string, unknown>;

  @Prop({ type: [String], default: [] })
  declare supportedCountries: string[];

  @Prop({ default: false })
  declare isDefault: boolean;

  @Prop({ default: false })
  declare requiresOnlineConfirmation: boolean;

  @Prop({ default: false })
  declare passFeesToCustomer: boolean;

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
PaymentMethodSchema.index({ provider: 1 });
PaymentMethodSchema.index({ type: 1 });
PaymentMethodSchema.index({ isDefault: 1 });

// Hooks for document creation/saving
PaymentMethodSchema.pre('save', function (next) {
  if (this.isModified('secretConfig') && this.secretConfig) {
    this.secretConfig = encryptConfigValues(this.secretConfig) as Record<
      string,
      unknown
    >;
  }
  next();
});

// 4. Comprehensive update hooks
interface UpdateQueryThis {
  getUpdate(): unknown;
}

PaymentMethodSchema.pre(
  ['findOneAndUpdate', 'updateOne', 'updateMany'],
  function (this: UpdateQueryThis, next) {
    const update = this.getUpdate() as {
      $set?: { secretConfig?: Record<string, unknown> };
      secretConfig?: Record<string, unknown>;
    } | null;

    if (update) {
      if (update.$set && update.$set.secretConfig) {
        update.$set.secretConfig = encryptConfigValues(
          update.$set.secretConfig,
        ) as Record<string, unknown>;
      } else if (update.secretConfig) {
        update.secretConfig = encryptConfigValues(
          update.secretConfig,
        ) as Record<string, unknown>;
      }
    }
    next();
  },
);

// Hooks for retrieval
PaymentMethodSchema.post('find', function (docs: PaymentMethodDocument[]) {
  if (Array.isArray(docs)) {
    //decrypt config values
    docs.forEach((doc) => {
      if (doc && doc.secretConfig) {
        doc.secretConfig = decryptConfigValues(doc.secretConfig) as Record<
          string,
          unknown
        >;
      }
    });
  }
});

PaymentMethodSchema.post(
  'findOne',
  function (doc: PaymentMethodDocument | null) {
    if (doc && doc.secretConfig) {
      doc.secretConfig = decryptConfigValues(doc.secretConfig) as Record<
        string,
        unknown
      >;
    }
  },
);
