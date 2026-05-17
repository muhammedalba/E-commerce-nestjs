import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { HydratedDocument, Types } from 'mongoose';
import * as mongoose from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

@Schema({ timestamps: true })
export class SubCategory {
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
    type: mongoose.Schema.Types.ObjectId,
    ref: MODEL_NAMES.CATEGORY,
    required: true,
  })
  declare category: Types.ObjectId;
}
export const SubCategorySchema = SchemaFactory.createForClass(SubCategory);
export type SubCategoryDocument = HydratedDocument<SubCategory>;
