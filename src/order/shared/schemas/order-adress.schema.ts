import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false }) // nested schema
export class OrderAddress {
  @Prop({ type: String, required: true })
  declare firsName: string;

  @Prop({ type: String, required: true })
  declare lastName: string;

  @Prop({ type: String, required: true })
  declare phone: string;

  @Prop({ type: String, required: true })
  declare country: string;

  @Prop({ type: String, required: true })
  declare city: string;

  @Prop({ type: String, required: true })
  declare street: string;

  @Prop({ type: String, required: true })
  declare building: string;

  @Prop({ type: String, required: true })
  declare postalCode: string;

  @Prop({ type: String, required: false })
  declare additionalInfo: string;

  @Prop({ type: String, required: true, default: 'home' })
  declare addressType: 'home' | 'office' | 'other'; // Type of address

  @Prop({ type: String, required: false })
  declare companyName: string; // Optional field for company name
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
  declare location: {
    type: string;
    coordinates: number[]; //[longitude, latitude]،
  };
}

export const OrderAddressSchema = SchemaFactory.createForClass(OrderAddress);
OrderAddressSchema.index({ location: '2dsphere' });
