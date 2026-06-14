import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as crypto from 'crypto';

const ENCRYPTION_KEY =
  process.env.PAYMENT_CONFIG_SECRET || 'a_secure_32_byte_fallback_key_!!';
const IV_LENGTH = 16;

function encryptString(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    iv,
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptString(text: string): string {
  if (!text || !text.includes(':')) return text;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY),
      iv,
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text; // Return as is if decryption fails
  }
}

function encryptConfigValues(config: Record<string, any>): Record<string, any> {
  if (!config) return config;
  const encryptedConfig: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && value.trim() !== '') {
      encryptedConfig[key] = encryptString(value);
    } else {
      encryptedConfig[key] = value;
    }
  }
  return encryptedConfig;
}

function decryptConfigValues(config: Record<string, any>): Record<string, any> {
  if (!config) return config;
  const decryptedConfig: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && value.includes(':')) {
      decryptedConfig[key] = decryptString(value);
    } else {
      decryptedConfig[key] = value;
    }
  }
  return decryptedConfig;
}

export type PaymentMethodDocument = HydratedDocument<PaymentMethod>;

export enum PaymentType {
  CARD = 'card',
  WALLET = 'wallet',
  BANK_TRANSFER = 'bank_transfer',
  CASH_ON_DELIVERY = 'cash_on_delivery',
  BUY_NOW_PAY_LATER = 'bnpl',
  CUSTOM = 'custom',
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
  declare fixedFee: number;

  @Prop({ default: 0 })
  declare percentageFee: number;

  @Prop({ default: '' })
  declare description: string;

  @Prop({ required: true, type: String })
  declare provider: string;

  @Prop({ type: Object, default: {} })
  declare config: Record<string, any>;

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

PaymentMethodSchema.pre('save', function (next) {
  if (this.isModified('config') && this.config) {
    this.config = encryptConfigValues(this.config);
  }
  next();
});

PaymentMethodSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as Record<string, any>;
  if (update) {
    if (update.$set && update.$set.config) {
      update.$set.config = encryptConfigValues(
        update.$set.config as Record<string, any>,
      );
      this.setUpdate(update);
    } else if (update.config) {
      update.config = encryptConfigValues(update.config as Record<string, any>);
      this.setUpdate(update);
    }
  }
  next();
});

PaymentMethodSchema.post('find', function (docs: PaymentMethodDocument[]) {
  if (Array.isArray(docs)) {
    docs.forEach((doc) => {
      if (doc && doc.config) {
        doc.config = decryptConfigValues(doc.config);
      }
    });
  }
});

PaymentMethodSchema.post(
  'findOne',
  function (doc: PaymentMethodDocument | null) {
    if (doc && doc.config) {
      doc.config = decryptConfigValues(doc.config);
    }
  },
);
