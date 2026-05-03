import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { HydratedDocument } from 'mongoose';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

@Schema({ timestamps: { updatedAt: true } })
export class PromoBanner {
  @Prop({ required: true })
  @IsDefined()
  @Type(() => FieldLocalizeDto)
  @ValidateNested()
  text!: FieldLocalizeDto;

  @Prop()
  link?: string;

  @Prop({ default: false })
  isActive?: boolean;
}

export const PromoBannerSchema = SchemaFactory.createForClass(PromoBanner);
export type PromoBannerDocument = HydratedDocument<PromoBanner>;

// ─── Auto-exclude soft-deleted documents ─────────────────
PromoBannerSchema.pre(['find', 'countDocuments'], function () {
  if (this.getFilter().isActive === undefined) {
    this.where({ isActive: { $ne: false } });
  }
});