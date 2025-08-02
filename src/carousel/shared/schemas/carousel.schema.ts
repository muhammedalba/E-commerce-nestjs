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
    required: false,
    type: Boolean,
    default: false,
  })
  isActive?: boolean;

  @Prop({
    required: true,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  carouselSm?: string;
  @Prop({
    required: true,
    type: 'string',
    default: '/default.png',
    trim: true,
  })
  carouselMd?: string;
  @Prop({
    required: true,
    type: 'string',
    default: '/default.png',
    trim: true,
  })
  carouselLg?: string;
}
export type CarouselDocument = HydratedDocument<Carousel>;
export const CarouselSchema = SchemaFactory.createForClass(Carousel);

//update , findOne and findAll
CarouselSchema.post('init', function (doc: HydratedDocument<Carousel>) {
  const hasTranslatedDescription =
    doc?.description &&
    typeof doc.description === 'object' &&
    Object.values(doc.description).some(
      (value) => typeof value === 'string' && value.trim() !== '',
    );

  const baseUrl = process.env.BASE_URL ?? '';

  if (hasTranslatedDescription) {
    const keys: Array<'carouselMd' | 'carouselSm' | 'carouselLg'> = [
      'carouselMd',
      'carouselSm',
      'carouselLg',
    ];

    keys.forEach((key) => {
      const path = doc[key];
      if (typeof path === 'string' && !path.startsWith(baseUrl)) {
        doc[key] = `${baseUrl}${path}`;
      }
    });
  }
});
