import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { FileAsset } from 'src/shared/schema/file-asset.schema';

export type ShippingProviderDocument = HydratedDocument<ShippingProvider>;

@Schema({ timestamps: true })
export class ShippingProvider {
  @Prop({ required: true })
  declare name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  declare code: string;

  @Prop({ default: '' })
  declare trackingUrl: string;

  @Prop({
    type: Object,
    default: { url: 'default.png', publicId: 'default.png', provider: 'local' },
  })
  declare logo: FileAsset;

  @Prop({ default: true })
  declare isActive: boolean;

  @Prop({ type: 'string', trim: true, lowercase: true })
  declare slug: string;
}

export const ShippingProviderSchema =
  SchemaFactory.createForClass(ShippingProvider);
