import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ShippingProviderDocument = HydratedDocument<ShippingProvider>;

@Schema({ timestamps: true })
export class ShippingProvider {
  @Prop({ required: true })
  declare name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  declare code: string;

  @Prop({ default: '' })
  declare trackingUrl: string;

  @Prop({ default: 'default.png' })
  declare logo: string;

  @Prop({ default: true })
  declare isActive: boolean;
}

export const ShippingProviderSchema =
  SchemaFactory.createForClass(ShippingProvider);
