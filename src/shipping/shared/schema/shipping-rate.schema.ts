import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { ShippingProvider } from './shipping-provider.schema';
import { Country } from 'src/locations/shared/schema/country.schema';
import { Region } from 'src/locations/shared/schema/region.schema';
import { City } from 'src/locations/shared/schema/city.schema';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

export type ShippingRateDocument = HydratedDocument<ShippingRate>;

@Schema({ timestamps: true })
export class ShippingRate {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.SHIPPING_PROVIDER,
    required: true,
  })
  declare provider: ShippingProvider;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.COUNTRY })
  declare country: Country;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.REGION })
  declare region: Region;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.CITY })
  declare city: City;

  @Prop({ type: Number, default: 0 })
  declare freeShippingThreshold: number;

  @Prop({ required: true })
  declare basePrice: number;

  @Prop({ required: true, default: 15 })
  declare baseWeight: number;

  @Prop({ required: true, default: 0 })
  declare additionalKgPrice: number;

  @Prop({ default: '' })
  declare estimatedDays: string;

  @Prop({ default: false })
  declare supportsCOD: boolean;

  @Prop({ default: true })
  declare isActive: boolean;
}

export const ShippingRateSchema = SchemaFactory.createForClass(ShippingRate);

ShippingRateSchema.index({ city: 1, isActive: 1 });
ShippingRateSchema.index({ region: 1, isActive: 1 });
ShippingRateSchema.index({ provider: 1, city: 1 });
ShippingRateSchema.index({ freeShippingThreshold: 1, city: 1, isActive: 1 });
