import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { ShippingProvider } from './shipping-provider.schema';
import { Country } from 'src/locations/shared/schema/country.schema';
import { Region } from 'src/locations/shared/schema/region.schema';
import { City } from 'src/locations/shared/schema/city.schema';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

export type ShippingRateDocument = HydratedDocument<ShippingRate>;

export enum ShippingRateScope {
  GLOBAL = 'global',
  COUNTRY = 'country',
  REGION = 'region',
  CITY = 'city',
}

@Schema({ timestamps: true })
export class ShippingRate {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.SHIPPING_PROVIDER,
    required: true,
  })
  declare provider: ShippingProvider;

  @Prop({ type: String, enum: ShippingRateScope, required: true })
  declare scope: ShippingRateScope;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.COUNTRY })
  declare country?: Country;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.REGION })
  declare region?: Region;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.CITY })
  declare city?: City;

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

// Partial unique indexes based on active scope + provider
ShippingRateSchema.index(
  { scope: 1, provider: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scope: ShippingRateScope.GLOBAL,
      isActive: true,
    },
    name: 'unique_active_global_shipping_rate',
  },
);

ShippingRateSchema.index(
  { scope: 1, country: 1, provider: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scope: ShippingRateScope.COUNTRY,
      isActive: true,
    },
    name: 'unique_active_country_shipping_rate',
  },
);

ShippingRateSchema.index(
  { scope: 1, country: 1, region: 1, provider: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scope: ShippingRateScope.REGION,
      isActive: true,
    },
    name: 'unique_active_region_shipping_rate',
  },
);

ShippingRateSchema.index(
  { scope: 1, country: 1, region: 1, city: 1, provider: 1 },
  {
    unique: true,
    partialFilterExpression: { scope: ShippingRateScope.CITY, isActive: true },
    name: 'unique_active_city_shipping_rate',
  },
);
