import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';

import { generateUniqueSlug } from 'src/shared/utils/slug.util';

@Schema({ timestamps: true })
export class Brand {
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
    required: false,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  image?: string;
}
export type BrandDocument = HydratedDocument<Brand>;
export const BrandSchema = SchemaFactory.createForClass(Brand);

//update , findOne and findAll
BrandSchema.post('init', function (doc: HydratedDocument<Brand>) {
  const hasTranslatedName =
    doc &&
    doc.name &&
    typeof doc.name === 'object' &&
    Object.values(doc.name).some(
      (value) => typeof value === 'string' && value.trim() !== '',
    );

  if (
    hasTranslatedName &&
    doc.image &&
    !doc.image.startsWith(process.env.BASE_URL ?? 'http')
  ) {
    doc.image = `${process.env.BASE_URL}${doc.image}`;
  }
});
BrandSchema.pre('save', async function (next) {
  if (this.isModified('name') && this.name) {
    const nameValue =
      typeof this.name === 'object'
        ? this.name.en?.trim() || this.name.ar?.trim() || ''
        : this.name.trim();
    // generate a unique slug
    const model = this.constructor as unknown as Model<Brand>;
    this.slug = await generateUniqueSlug(nameValue, model);
  }
  next();
});
BrandSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update && typeof update === 'object' && '$set' in update) {
    if (update?.$set?.name) {
      const name = update.$set.name as string | { en?: string; ar?: string };
      const nameValue: string =
        typeof name === 'object' ? name.en || name.ar || '' : name;
      //
      const model = this.model as Model<Brand>;
      // generate a unique slug
      const newSlug = await generateUniqueSlug(nameValue, model);
      update.slug = newSlug;
      this.setUpdate(update);
    }
  }

  next();
});
