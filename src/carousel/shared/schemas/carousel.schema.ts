import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Carousel {
  @Prop({
    type: Object,
    i18n: true,
  })
  description!: string | { en?: string; ar?: string };
  @Prop({
    type: 'string',
    trim: true,
    lowercase: true,
  })
  slug?: string;

  @Prop({
    required: true,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  image?: string;
}
export type CarouselDocument = HydratedDocument<Carousel>;
export const CarouselSchema = SchemaFactory.createForClass(Carousel);

//update , findOne and findAll
CarouselSchema.post('init', function (doc: HydratedDocument<Carousel>) {
  const hasTranslatedName =
    doc &&
    doc.description &&
    typeof doc.description === 'object' &&
    Object.values(doc.description).some(
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
