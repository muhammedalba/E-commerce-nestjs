import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

@Schema({ _id: false }) // nested schema
export class OrderAddress {
  @Prop({ type: String, required: true })
  declare firstName: string;

  @Prop({ type: String, required: true })
  declare lastName: string;

  @Prop({ type: String, required: true })
  declare phone: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.COUNTRY,
    required: true,
  })
  declare country: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.CITY,
    required: true,
  })
  declare city: Types.ObjectId;

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
