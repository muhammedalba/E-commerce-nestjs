import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Types } from 'mongoose';

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
    validate: {
      validator: function (this: Product, val: number) {
        return val < this.price;
      },
      message: 'Discounted price must be less than original price',
    },
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
    ref: 'Category',
    required: [true, 'product must have a parent category'],
  })
  category?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Brand',
  })
  brand?: Types.ObjectId;

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
