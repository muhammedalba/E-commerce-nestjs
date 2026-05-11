import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CountryDocument = HydratedDocument<Country>;

@Schema({ timestamps: true })
export class Country {
  @Prop({ type: Object, required: true })
  declare name: { ar: string; en: string };

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  declare code: string;

  @Prop({ default: '' })
  declare phoneCode: string;

  @Prop({ default: 'SAR' })
  declare currency: string;

  @Prop({ default: true })
  declare isActive: boolean;
}

export const CountrySchema = SchemaFactory.createForClass(Country);

CountrySchema.index({ isActive: 1 });
