import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as crypto from 'crypto';

// 1. Key Length Safety: Guarantee exactly 32 bytes using SHA-256 hash
const RAW_SECRET =
  process.env.PAYMENT_CONFIG_SECRET || 'fallback_secret_do_not_use_in_prod';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(RAW_SECRET).digest();
const IV_LENGTH = 12; // GCM standard IV size is 12 bytes

function encryptString(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get Auth Tag for GCM
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptString(text: string): string {
  if (!text || typeof text !== 'string') return text;

  const textParts = text.split(':');
  // If it doesn't match our 3-part format, return as is
  if (textParts.length !== 3) return text;

  try {
    const [ivHex, authTagHex, encryptedHex] = textParts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag); // Required for GCM

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    // Return original if decryption fails (e.g. tampered data)
    return text;
  }
}

// 2. Recursive encryption to handle nested config objects
function encryptConfigValues(config: unknown): unknown {
  if (!config || typeof config !== 'object') return config;
  if (Array.isArray(config)) {
    return (config as unknown[]).map((item) => encryptConfigValues(item));
  }

  const encryptedConfig: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    config as Record<string, unknown>,
  )) {
    if (typeof value === 'string' && value.trim() !== '') {
      encryptedConfig[key] = encryptString(value);
    } else if (typeof value === 'object' && value !== null) {
      encryptedConfig[key] = encryptConfigValues(value); // Recursive call
    } else {
      encryptedConfig[key] = value;
    }
  }
  return encryptedConfig;
}

// 3. Recursive decryption
function decryptConfigValues(config: unknown): unknown {
  if (!config || typeof config !== 'object') return config;
  if (Array.isArray(config)) {
    return (config as unknown[]).map((item) => decryptConfigValues(item));
  }

  const decryptedConfig: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    config as Record<string, unknown>,
  )) {
    if (typeof value === 'string' && value.includes(':')) {
      decryptedConfig[key] = decryptString(value);
    } else if (typeof value === 'object' && value !== null) {
      decryptedConfig[key] = decryptConfigValues(value); // Recursive call
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
  declare config: Record<string, unknown>;

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
  if (this.isModified('config') && this.config) {
    this.config = encryptConfigValues(this.config) as Record<string, unknown>;
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
      $set?: { config?: Record<string, unknown> };
      config?: Record<string, unknown>;
    } | null;

    if (update) {
      if (update.$set && update.$set.config) {
        update.$set.config = encryptConfigValues(update.$set.config) as Record<
          string,
          unknown
        >;
      } else if (update.config) {
        update.config = encryptConfigValues(update.config) as Record<
          string,
          unknown
        >;
      }
    }
    next();
  },
);

// Hooks for retrieval
PaymentMethodSchema.post('find', function (docs: PaymentMethodDocument[]) {
  if (Array.isArray(docs)) {
    docs.forEach((doc) => {
      if (doc && doc.config) {
        doc.config = decryptConfigValues(doc.config) as Record<string, unknown>;
      }
    });
  }
});

PaymentMethodSchema.post(
  'findOne',
  function (doc: PaymentMethodDocument | null) {
    if (doc && doc.config) {
      doc.config = decryptConfigValues(doc.config) as Record<string, unknown>;
    }
  },
);
