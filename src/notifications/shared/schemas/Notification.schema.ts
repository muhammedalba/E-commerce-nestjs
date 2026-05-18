import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

export enum NotificationType {
  DIRECT = 'DIRECT',
  BROADCAST = 'BROADCAST',
}

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ type: String, enum: NotificationType, required: true })
  declare type: NotificationType;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.USER,
    default: null,
  })
  declare recipient: Types.ObjectId | null;

  @Prop({ required: true })
  declare action: string;

  @Prop({ required: true })
  declare message: string;

  @Prop({ type: Object, default: {} })
  declare payload: Record<string, any>;

  @Prop({ default: false })
  declare isRead: boolean;

  @Prop({ type: Date, default: null })
  declare readAt: Date | null;

  @Prop({ default: false })
  declare deletedByAdmin: boolean;

  @Prop({ type: [Types.ObjectId], default: [] })
  declare deletedByUsers: Types.ObjectId[];

  @Prop({ type: Date, expires: 86400 * 90, default: Date.now })
  declare createdAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ type: 1, deletedByAdmin: 1 });
