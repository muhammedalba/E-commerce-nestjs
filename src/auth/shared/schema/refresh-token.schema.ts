import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({
    type: 'string',
    trim: true,
    unique: true,
    required: true,
  })
  declare refresh_Token: string;
  @Prop({
    type: mongoose.Types.ObjectId,
    required: true,
    ref: MODEL_NAMES.USER,
  })
  declare userId: string;

  // One login on one device. Kept across rotations so logout can revoke
  // exactly this device's session (the access token carries it as `sid`).
  // Absent on tokens issued before sessions existed.
  @Prop({ type: 'string', index: true })
  declare sessionId?: string;

  @Prop({
    required: true,
    type: Date,
    expires: '0s', // Automatically delete document when expiryDate is reached
  })
  declare expiryDate: Date;
}
export type refreshTokenDocument = HydratedDocument<RefreshToken>;
export const refreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
