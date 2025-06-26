import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import slugify from 'slugify';

@Schema({ timestamps: true })
export class Supplier {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ required: true, unique: true })
  slug?: string;

  @Prop()
  contactName?: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  address?: string;

  @Prop()
  website?: string;

  @Prop({
    required: false,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  avatar?: string;

  @Prop({
    required: false,
    type: 'string',
    default: 'supplier',
    trim: true,
  })
  role?: string;

  @Prop({
    required: false,
    type: String,
    default: 'active',
    enum: ['inactive', 'active'],
    trim: true,
  })
  status?: 'active' | 'inactive';
}
export type SupplierDocument = HydratedDocument<Supplier>;
export const SupplierSchema = SchemaFactory.createForClass(Supplier);

SupplierSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update && typeof update === 'object' && '$set' in update) {
    // Check if the name field is being updated
    if (update?.$set?.name && typeof update.$set.name === 'string') {
      update.$set.slug = slugify(update.$set.name, { lower: true });
    }
  }

  next();
});

//update , findOne and findAll
SupplierSchema.post('init', function (doc) {
  if (doc.avatar && doc.name) {
    if (!doc.avatar.startsWith(process.env.BASE_URL ?? 'http')) {
      doc.avatar = `${process.env.BASE_URL}${doc.avatar}`;
    }
  }
});
