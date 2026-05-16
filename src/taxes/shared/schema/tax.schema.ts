import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

export type TaxDocument = HydratedDocument<Tax>;

@Schema({ timestamps: true })
export class Tax {
  @Prop({ required: true, default: 'VAT' })
  declare name: string;

  @Prop({ required: true, default: 15, min: 0, max: 100 })
  declare percentage: number;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: MODEL_NAMES.COUNTRY, required: false })
  declare country: Types.ObjectId | null;

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


// Ensure a country can only have one tax rule (sparse allows multiple nulls for global rules)
// ضريبة نشطة واحدة فقط لكل دولة
TaxSchema.index(
  { country: 1 },
  {
    unique: true,
    partialFilterExpression: { country: { $type: 'objectId' }, isActive: true }
  }
);
// اسم فريد للضرائب العالمية النشطة
TaxSchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { country: null, isActive: true }
  }
);