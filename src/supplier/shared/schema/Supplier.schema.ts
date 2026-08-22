import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { FileAsset } from 'src/shared/schema/file-asset.schema';

@Schema({ timestamps: true })
export class Supplier {
  @Prop({ required: true, unique: true })
  declare name: string;

  @Prop({ required: true, unique: true })
  declare slug: string;

  @Prop()
  declare contactName: string;

  @Prop()
  declare phone: string;

  @Prop()
  declare email: string;

  @Prop()
  declare address: string;

  @Prop()
  declare website: string;

  @Prop({
    required: false,
    type: Object,
    default: { url: 'avatar.png', publicId: 'avatar.png', provider: 'local' },
  })
  declare avatar: FileAsset;

  @Prop({
    required: false,
    type: 'string',
    default: 'supplier',
    trim: true,
  })
  declare role: string;

  @Prop({
    required: false,
    type: Boolean,
    default: true,
  })
  declare isActive: boolean;
}
export type SupplierDocument = HydratedDocument<Supplier>;
export const SupplierSchema = SchemaFactory.createForClass(Supplier);
SupplierSchema.index({ name: 1 }, { unique: true, sparse: true });
SupplierSchema.index({ slug: 1 }, { unique: true, sparse: true });

// ─── Auto-exclude soft-deleted documents ─────────────────
SupplierSchema.pre(['find', 'countDocuments'], function () {
  if (this.getFilter().isActive === undefined) {
    this.where({ isActive: { $ne: false } });
  }
});
