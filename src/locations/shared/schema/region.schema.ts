import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Country } from './country.schema';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

export type RegionDocument = HydratedDocument<Region>;

@Schema({ timestamps: true })
export class Region {
  @Prop({ type: Object, required: true })
  @IsDefined()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  declare name: FieldLocalizeDto;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.COUNTRY,
    required: true,
  })
  declare country: Types.ObjectId;

  @Prop({ default: true })
  declare isActive: boolean;
}

export const RegionSchema = SchemaFactory.createForClass(Region);

RegionSchema.index({ country: 1 });
RegionSchema.index({ country: 1, isActive: 1 });
RegionSchema.index(
  { 'name.ar': 1, country: 1 },
  { unique: true, sparse: true },
);
RegionSchema.index(
  { 'name.en': 1, country: 1 },
  { unique: true, sparse: true },
);
