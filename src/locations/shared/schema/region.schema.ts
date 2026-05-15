import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { Country } from './country.schema';

export type RegionDocument = HydratedDocument<Region>;

@Schema({ timestamps: true })
export class Region {
  @Prop({ type: Object, required: true })
  declare name: { ar: string; en: string };

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Country.name,
    required: true,
  })
  declare country: Country;

  @Prop({ default: true })
  declare isActive: boolean;
}

export const RegionSchema = SchemaFactory.createForClass(Region);

RegionSchema.index({ country: 1 });
RegionSchema.index({ country: 1, isActive: 1 });
RegionSchema.index({ 'name.ar': 1, country: 1 }, { unique: true, sparse: true });
RegionSchema.index({ 'name.en': 1, country: 1 }, { unique: true, sparse: true });
