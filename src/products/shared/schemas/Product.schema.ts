import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';
import { Brand } from 'src/brands/shared/schemas/brand.schema';
import { Category } from 'src/categories/shared/schemas/category.schema';
import { SupCategory } from 'src/sup-category/shared/schemas/sup-category.schema';
import { Supplier } from 'src/supplier/shared/schema/Supplier.schema';

@Schema({
  timestamps: true,
  //   toJSON: { virtuals: true },
  //   toObject: { virtuals: true },
})
export class Product {
  @Prop({
    type: Object,
    i18n: true,
    trim: true,
    required: [true, 'product title required'],
    minlength: 3,
    maxlength: 70,
  })
  title!: string;

  @Prop({
    type: String,
    required: true,
    lowercase: true,
  })
  slug!: string;

  @Prop({
    type: Boolean,
    default: true,
  })
  isUnlimitedStock!: boolean;
  @Prop({
    type: Boolean,
    default: false,
  })
  disabled!: boolean;

  @Prop({
    type: String,
    trim: true,
    required: [true, 'product description required'],
    minlength: 15,
  })
  description!: string;

  @Prop({
    type: Number,
    required: [true, 'product quantity required'],
  })
  quantity!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  sold!: number;

  @Prop({
    type: Number,
    required: [true, 'product price required'],
    max: 20000,
  })
  price!: number;

  @Prop({
    type: Number,
  })
  priceAfterDiscount!: number;

  @Prop({
    type: [String],
  })
  colors!: string[];

  @Prop({
    type: String,
    required: [true, 'product imageCover is required'],
  })
  imageCover!: string;

  @Prop({
    type: [String],
  })
  images?: string[];

  @Prop({
    type: Types.ObjectId,
    ref: Category.name,
    required: false,
  })
  category?: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: SupCategory.name, required: true }],
  })
  supCategories!: Types.ObjectId[];

  @Prop({
    type: Types.ObjectId,
    ref: Brand.name,
  })
  brand?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Supplier.name })
  supplier?: Types.ObjectId;

  @Prop({
    type: Number,
    min: 1,
    max: 5,
    default: 1,
  })
  rating?: number;

  @Prop({
    type: Number,
    default: 0,
  })
  ratingsQuantity?: number;

  @Prop({
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  })
  ratingsAverage!: number;

  @Prop({
    type: String,
  })
  infoProductPdf?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
export type ProductDocument = HydratedDocument<Product>;
// Virtual Populate (for example: reviews)
// ProductSchema.virtual('reviews', {
//   ref: 'Review',
//   localField: '_id',
//   foreignField: 'product',
// });

ProductSchema.post('init', function (doc: HydratedDocument<Product>) {
  const hasTranslatedDescription =
    doc?.title &&
    typeof doc.title === 'object' &&
    Object.values(doc.title).some(
      (value) => typeof value === 'string' && value.trim() !== '',
    );

  const baseUrl = process.env.BASE_URL ?? '';

  if (hasTranslatedDescription) {
    ['imageCover', 'infoProductPdf'].forEach((key) => {
      const path = doc[key as keyof Product];
      if (typeof path === 'string' && !path.startsWith(baseUrl)) {
        doc[key] = `${baseUrl}${path}`;
      }
    });
    const paths = doc?.images?.map((key) => `${baseUrl}${key}`);
    doc.images = paths;
  }
});
