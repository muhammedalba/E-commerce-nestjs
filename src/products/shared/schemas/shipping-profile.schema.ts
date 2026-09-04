import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum PackageType {
  BOX = 'box',
  BAG = 'bag',
  PALLET = 'pallet',
  ROLL = 'roll',
  ENVELOPE = 'envelope',
  DRUM = 'drum',
  GALLON = 'gallon',
  BOARD = 'board',
  PIECE = 'piece',
  CUSTOM = 'custom',
}

// ─── Dimensions Sub-Schema ───────────────────────────────
@Schema({ _id: false })
export class ShippingDimensions {
  @Prop({ type: Number, required: false, min: 0.1 })
  declare lengthMm: number;

  @Prop({ type: Number, required: false, min: 0.1 })
  declare widthMm: number;

  @Prop({ type: Number, required: false, min: 0.1 })
  declare heightMm: number;
}

export const ShippingDimensionsSchema =
  SchemaFactory.createForClass(ShippingDimensions);

// ─── Shipping Profile Sub-Schema ─────────────────────────
@Schema({ _id: false })
export class ShippingProfile {
  /**
   * Shipping weight of ONE sellable ProductVariant unit in grams (canonical unit).
   * E.g. 20000 = 20kg.
   */
  @Prop({ type: Number, required: true, min: 0 })
  declare weightGrams: number;

  /**
   * Package dimensions in millimeters (canonical unit).
   */
  @Prop({ type: ShippingDimensionsSchema, required: false })
  declare dimensions?: ShippingDimensions;

  /**
   * Package container type for logistics categorization.
   */
  @Prop({
    type: String,
    enum: Object.values(PackageType),
    default: PackageType.BOX,
    required: true,
  })
  declare packageType: PackageType;

  /**
   * Number of sellable variant units that can be placed in one shipping package.
   * Stored as structured logistics metadata for future warehouse/fulfillment use.
   */
  @Prop({ type: Number, required: true, min: 1, default: 1 })
  declare quantityPerPackage: number;
}

export const ShippingProfileSchema =
  SchemaFactory.createForClass(ShippingProfile);
