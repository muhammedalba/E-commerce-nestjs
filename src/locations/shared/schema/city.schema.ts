import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { Country } from './country.schema';
import { Region } from './region.schema';

export type CityDocument = HydratedDocument<City>;

@Schema({ timestamps: true })
export class City {
  @Prop({ type: Object, required: true })
  declare name: { ar: string; en: string };

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Country.name,
    required: true,
  })
  declare country: Country;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Region.name,
    required: true,
  })
  declare region: Region;

  @Prop({ default: '' })
  declare postalCode: string;

  @Prop({ default: 0 })
  declare latitude: number;

  @Prop({ default: 0 })
  declare longitude: number;

  @Prop({ default: true })
  declare isDeliveryAvailable: boolean;

  @Prop({ default: true })
  declare isActive: boolean;
}

export const CitySchema = SchemaFactory.createForClass(City);

CitySchema.index({ country: 1 });
CitySchema.index({ region: 1, isDeliveryAvailable: 1, isActive: 1 });
CitySchema.index({ 'name.ar': 1, region: 1 }, { unique: true, sparse: true });
CitySchema.index({ 'name.en': 1, region: 1 }, { unique: true, sparse: true });
