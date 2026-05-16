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

  @Prop({
    required: true,
    type: Date,
  })
  declare expiryDate: Date;
}
export type refreshTokenDocument = HydratedDocument<RefreshToken>;
export const refreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
