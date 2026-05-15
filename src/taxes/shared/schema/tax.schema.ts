import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Country } from 'src/locations/shared/schema/country.schema';

export type TaxDocument = HydratedDocument<Tax>;

@Schema({ timestamps: true })
export class Tax {
  @Prop({ required: true, default: 'VAT' })
  declare name: string;

  @Prop({ required: true, default: 15, min: 0, max: 100 })
  declare percentage: number;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Country.name, required: false })
  declare country?: Country;

  @Prop({ default: '' })
  declare taxNumber: string;

  @Prop({ default: false })
  declare isIncludedInPrice: boolean;

  @Prop({ default: true })
  declare isActive: boolean;

  @Prop({ default: '' })
  declare description: string;
}

export const TaxSchema = SchemaFactory.createForClass(Tax);

// Ensure only one active tax rule per country (or one global active rule)
// This allows multiple inactive rules for the same country/global but only one active.
TaxSchema.index(
  { country: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  },
);
