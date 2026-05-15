import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';
import { generateUniqueSlug } from 'src/shared/utils/slug.util';

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
    default: 'avatar.png',
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
    type: Boolean,
    default: true,
  })
  isActive?: boolean;
}
export type SupplierDocument = HydratedDocument<Supplier>;
export const SupplierSchema = SchemaFactory.createForClass(Supplier);

// ─── Auto-exclude soft-deleted documents ─────────────────
SupplierSchema.pre(['find', 'countDocuments'], function () {
  if (this.getFilter().isActive === undefined) {
    this.where({ isActive: { $ne: false } });
  }
  
});

//  update, findByIdAndUpdate ,findOne
SupplierSchema.pre('findOneAndUpdate', async function (this: any, next) {
  const update = this.getUpdate();
  if (update && typeof update === 'object' && '$set' in update) {
    // Check if the name field is being updated
    if (update?.$set?.name && typeof update.$set.name === 'string') {
      const nameValue: string = update.$set.name;
      const model = this.model as Model<Supplier>;
      // generate a unique slug
      // Extract current document _id to exclude it from slug uniqueness check
      const conditions = this.getQuery();
      const excludeId = conditions._id ?? conditions.id ?? undefined;
      // generate a unique slug (excluding current doc so its own slug isn't flagged)
      const newSlug = await generateUniqueSlug(nameValue, model, excludeId);
      update.slug = newSlug;
      this.setUpdate(update);
    }
  }

  next();
});

//update , findOne and findAll
// SupplierSchema.post('init', function (doc) {
  
//   if (doc.avatar && !doc.avatar.startsWith(process.env.BASE_URL ?? 'http')) {
//     doc.avatar = `${process.env.BASE_URL}${doc.avatar}`; 
//   }
// });
