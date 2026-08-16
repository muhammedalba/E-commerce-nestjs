import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Carousel {
  @Prop({
    type: Object,
  })
  declare description: string | { en?: string; ar?: string };
  @Prop({
    type: 'string',
    trim: true,
    lowercase: true,
  })
  declare slug: string;

  @Prop({
    required: false,
    type: Boolean,
    default: false,
  })
  declare isActive: boolean;

  @Prop({
    required: true,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  declare carouselSm: string;
  @Prop({
    required: true,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  declare carouselMd: string;
  @Prop({
    required: true,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  declare carouselLg: string;
}
export type CarouselDocument = HydratedDocument<Carousel>;
export const CarouselSchema = SchemaFactory.createForClass(Carousel);

// Enforce uniqueness at the database level to prevent race conditions
// under high concurrency (avoids the TOCTOU gap in manual exists() + create() checks).
CarouselSchema.index({ slug: 1 }, { unique: true, sparse: true });

// ─── Auto-exclude soft-deleted documents ─────────────────
CarouselSchema.pre(['find', 'countDocuments'], function () {
  if (this.getFilter().isActive === undefined) {
    this.where({ isActive: { $ne: false } });
  }
});
