import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({
    type: 'string',
    trim: true,
    unique: true,
    required: true,
  })
  refresh_Token!: string;
  @Prop({
    type: mongoose.Types.ObjectId,
    required: true,
    ref: 'User',
  })
  userId?: string;

  @Prop({
    required: true,
    type: Date,
  })
  expiryDate!: Date;
}
export type refreshTokenDocument = HydratedDocument<RefreshToken>;
export const refreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
