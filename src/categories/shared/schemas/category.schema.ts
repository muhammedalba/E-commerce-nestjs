import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { HydratedDocument, Model } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Category {
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
  declare slug: string;

  @Prop({
    required: false, 
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  declare image: string | undefined;
}
export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.virtual('SubCategories', {
  ref: MODEL_NAMES.SUB_CATEGORY,
  localField: '_id',
  foreignField: 'category',
});

// removed hooks since slug logic is moved to service
