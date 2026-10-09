import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
}

/** Days a device token survives without the app re-registering it. */
export const DEVICE_TOKEN_TTL_DAYS = 60;

/**
 * An FCM registration token of one app install, owned by the login session
 * that registered it: pushes go only to tokens whose session is still alive.
 */
@Schema({ timestamps: true, collection: 'device_tokens' })
export class DeviceToken {
  /** FCM registration token; one install has exactly one at a time. */
  @Prop({ type: String, required: true, unique: true })
  declare token: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.USER,
    required: true,
    index: true,
  })
  declare user: Types.ObjectId;

  /** `sid` of the access token that registered it (one login on one device). */
  @Prop({ type: String, required: true })
  declare sessionId: string;

  @Prop({ type: String, enum: DevicePlatform, required: true })
  declare platform: DevicePlatform;

  /** Language the notifications are written in. */
  @Prop({ type: String, enum: ['ar', 'en'], default: 'ar' })
  declare lang: 'ar' | 'en';

  /** Refreshed on every registration; idle tokens expire (FCM marks them stale). */
  @Prop({
    type: Date,
    default: Date.now,
    expires: DEVICE_TOKEN_TTL_DAYS * 24 * 60 * 60,
  })
  declare lastSeenAt: Date;
}

export type DeviceTokenDocument = HydratedDocument<DeviceToken>;
export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);
