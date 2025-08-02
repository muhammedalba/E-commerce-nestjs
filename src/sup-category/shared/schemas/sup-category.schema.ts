import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';
import { Category } from 'src/categories/shared/schemas/category.schema';
import { generateUniqueSlug } from 'src/shared/utils/slug.util';

@Schema({ timestamps: true })
export class SupCategory {
  @Prop({
    type: Object,
    i18n: true,
  })
  name!: string | { en?: string; ar?: string };
  @Prop({
    type: 'string',
    trim: true,
    lowercase: true,
  })
  slug?: string;
  @Prop({
    type: Types.ObjectId,
    ref: Category.name,
    required: true,
  })
  category!: Types.ObjectId;
}
export const SupCategorySchema = SchemaFactory.createForClass(SupCategory);
export type SupCategoryDocument = HydratedDocument<SupCategory>;

//update , findOne and findAll
// this will be used to generate the slug
SupCategorySchema.pre('save', async function (next) {
  if (this.isModified('name') && this.name) {
    const nameValue =
      typeof this.name === 'object'
        ? this.name.en?.trim() || this.name.ar?.trim() || ''
        : this.name.trim();
    // generate a unique slug
    const model = this.constructor as unknown as Model<SupCategory>;
    this.slug = await generateUniqueSlug(nameValue, model);
  }
  next();
});
// this will be used to generate the slug
SupCategorySchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update && typeof update === 'object' && '$set' in update) {
    if (update?.$set?.name) {
      const name = update.$set.name as string | { en?: string; ar?: string };
      const nameValue: string =
        typeof name === 'object' ? name.en || name.ar || '' : name;
      //
      const model = this.model as Model<SupCategory>;
      // generate a unique slug
      const newSlug = await generateUniqueSlug(nameValue, model);
      update.slug = newSlug;
      this.setUpdate(update);
    }
  }

  next();
});
