import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

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
    type: 'string',
    default: 'avatar.png',
    trim: true,
  })
  declare avatar: string;

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

// ─── Auto-exclude soft-deleted documents ─────────────────
SupplierSchema.pre(['find', 'countDocuments'], function () {
  if (this.getFilter().isActive === undefined) {
    this.where({ isActive: { $ne: false } });
  }
  
});



//update , findOne and findAll
// SupplierSchema.post('init', function (doc) {
  
//   if (doc.avatar && !doc.avatar.startsWith(process.env.BASE_URL ?? 'http')) {
//     doc.avatar = `${process.env.BASE_URL}${doc.avatar}`; 
//   }
// });
