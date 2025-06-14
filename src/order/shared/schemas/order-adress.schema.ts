import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ _id: false }) // nested schema
export class OrderAddress {
  @Prop({ type: String, required: true })
  firsName!: Types.ObjectId;

  @Prop({ type: String, required: true })
  lastName!: Types.ObjectId;

  @Prop({ type: String, required: true })
  phone!: string;

  @Prop({ type: String, required: true })
  country!: string;

  @Prop({ type: String, required: true })
  city!: string;

  @Prop({ type: String, required: true })
  street!: string;

  @Prop({ type: String, required: true })
  building!: string; // Building number or name مبنى

  @Prop({ type: String, required: true })
  postalCode?: string;

  @Prop({ type: String, required: true })
  additionalInfo?: string; // Optional field for any additional information

  @Prop({ type: String, required: true })
  addressType!: 'home' | 'office' | 'other'; // Type of address

  @Prop({ type: String, required: false })
  companyName?: string; // Optional field for company name
}

export const OrderAddressSchema = SchemaFactory.createForClass(OrderAddress);
