import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { HydratedDocument, Model } from 'mongoose';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

@Schema({ timestamps: true })
export class Brand {
  @Prop({ type: Object, required: true })
  @IsDefined()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  declare name: FieldLocalizeDto;

  @Prop({
    type: 'string',
    trim: true,
    lowercase: true,
  })
  declare slug: string | undefined;

  @Prop({
    required: false,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  declare image: string | undefined;
}
export type BrandDocument = HydratedDocument<Brand>;
export const BrandSchema = SchemaFactory.createForClass(Brand);
