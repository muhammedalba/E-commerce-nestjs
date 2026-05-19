import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { FieldLocalizeDto } from 'src/shared/utils/field-locolaized.dto';

export enum NotificationType {
  DIRECT = 'DIRECT',
  BROADCAST = 'BROADCAST',
  ROLE = 'ROLE',
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

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.ROLE,
    default: null,
  })
  declare targetRole: Types.ObjectId | null;

  @Prop({ required: true })
  declare action: string;

  @Prop({ type: Object, required: true })
  @IsDefined()
  @ValidateNested()
  @Type(() => FieldLocalizeDto)
  declare message: FieldLocalizeDto;

  @Prop({ type: Object, default: {} })
  declare payload: Record<string, any>;

  @Prop({ default: false })
  declare isRead: boolean;

  @Prop({ type: Date, default: null })
  declare readAt: Date | null;

  @Prop({ default: false })
  declare deletedByAdmin: boolean;

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  declare deletedByUsers: Types.ObjectId[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  declare readByUsers: Types.ObjectId[];

  @Prop({ type: Date, expires: 86400 * 90, default: Date.now })
  declare createdAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ type: 1, deletedByAdmin: 1 });
NotificationSchema.index({ targetRole: 1, type: 1 });
NotificationSchema.index({ deletedByAdmin: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, deletedByAdmin: 1, createdAt: -1 });
