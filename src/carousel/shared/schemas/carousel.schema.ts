import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { FileAsset } from 'src/shared/schema/file-asset.schema';

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
    type: Object,
    default: { url: 'default.png', publicId: 'default.png', provider: 'local' },
  })
  declare carouselSm: FileAsset;
  @Prop({
    required: true,
    type: Object,
    default: { url: 'default.png', publicId: 'default.png', provider: 'local' },
  })
  declare carouselMd: FileAsset;
  @Prop({
    required: true,
    type: Object,
    default: { url: 'default.png', publicId: 'default.png', provider: 'local' },
  })
  declare carouselLg: FileAsset;
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
