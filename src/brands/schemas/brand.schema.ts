import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
// import slugify from 'slugify';

@Schema({ timestamps: true })
export class Brand {
  @Prop({
    i18n: true,
  })
  name!: string;
  // @Prop({
  //   type: 'string',
  //   trim: true,
  //   lowercase: true,
  // })
  // slug?: string;

  @Prop({
    required: false,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  image?: string;
}
export type BrandDocument = HydratedDocument<Brand>;
export const BrandSchema = SchemaFactory.createForClass(Brand);
// // Hook for hashing password before saving
// BrandSchema.pre('save', function (next) {
//   if (this.name) {
//     this.slug = slugify(this.name, { lower: true });
//   }

//   next();
// });
// //update , findOne and findAll
// BrandSchema.post('init', function (doc) {
//   // if query is not find and delete
//   if (doc.image && doc.name) {
//     doc.image = `${process.env.BASE_URL}${doc.image}`;
//   }
// });
