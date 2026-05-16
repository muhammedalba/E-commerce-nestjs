import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { HydratedDocument } from 'mongoose';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

export type CountryDocument = HydratedDocument<Country>;

@Schema({ timestamps: true })
export class Country {
  @Prop({ type: Object, required: true })
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()

  declare name: FieldLocalizeDto;

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
CountrySchema.index({ 'name.ar': 1 }, { unique: true, sparse: true });
CountrySchema.index({ 'name.en': 1 }, { unique: true, sparse: true });
