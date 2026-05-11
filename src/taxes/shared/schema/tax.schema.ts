import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TaxDocument = HydratedDocument<Tax>;

@Schema({ timestamps: true })
export class Tax {
  @Prop({ required: true, default: 'VAT' })
  declare name: string;

  @Prop({ required: true, default: 15, min: 0, max: 100 })
  declare percentage: number;

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
