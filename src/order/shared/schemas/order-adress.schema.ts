import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false }) // nested schema
export class OrderAddress {
  @Prop({ type: String, required: true })
  firsName!: string;

  @Prop({ type: String, required: true })
  lastName!: string;

  @Prop({ type: String, required: true })
  phone!: string;

  @Prop({ type: String, required: true })
  country!: string;

  @Prop({ type: String, required: true })
  city!: string;

  @Prop({ type: String, required: true })
  street!: string;

  @Prop({ type: String, required: true })
  building!: string;

  @Prop({ type: String, required: true })
  postalCode?: string;

  @Prop({ type: String, required: false })
  additionalInfo?: string;

  @Prop({ type: String, required: true, default: 'home' })
  addressType!: 'home' | 'office' | 'other'; // Type of address

  @Prop({ type: String, required: false })
  companyName?: string; // Optional field for company name
  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: false,
    },
    coordinates: {
      type: [Number],
      required: false,
    },
  })
  location?: {
    type: string;
    coordinates: number[]; //[longitude, latitude]،
  };
}

export const OrderAddressSchema = SchemaFactory.createForClass(OrderAddress);
OrderAddressSchema.index({ location: '2dsphere' });
