import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { HydratedDocument } from 'mongoose';
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

// Enforce uniqueness at the database level to prevent race conditions
// under high concurrency (avoids the TOCTOU gap in manual exists() + create() checks).
CategorySchema.index({ 'name.en': 1 }, { unique: true, sparse: true });
CategorySchema.index({ slug: 1 }, { unique: true, sparse: true });

CategorySchema.virtual('SubCategories', {
  ref: MODEL_NAMES.SUB_CATEGORY,
  localField: '_id',
  foreignField: 'category',
});

// removed hooks since slug logic is moved to service
