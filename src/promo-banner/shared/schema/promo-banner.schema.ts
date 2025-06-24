import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: { updatedAt: true } })
export class PromoBanner {
  @Prop({ required: true, minlength: 3, max: 400, i18n: true })
  text!: string;

  @Prop({ default: true })
  isActive?: boolean;
}

export const PromoBannerSchema = SchemaFactory.createForClass(PromoBanner);
export type PromoBannerDocument = HydratedDocument<PromoBanner>;
