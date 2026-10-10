import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { DevicePlatform } from 'src/notifications/push/schemas/device-token.schema';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';

/**
 * Update policy of the mobile app on one platform (one document per
 * platform). An install below `minSupportedVersion`, or on one of
 * `blockedVersions`, must update; one below `latestVersion` may update.
 */
@Schema({ timestamps: true, collection: 'app_version_policies' })
export class AppVersionPolicy {
  @Prop({ type: String, enum: DevicePlatform, required: true, unique: true })
  declare platform: DevicePlatform;

  /** Newest version live in the store: older installs get an optional prompt. */
  @Prop({ type: String, default: '1.0.0' })
  declare latestVersion: string;

  /** Oldest version the API still serves: older installs must update. */
  @Prop({ type: String, default: '1.0.0' })
  declare minSupportedVersion: string;

  /** Versions that must update regardless of the minimum (e.g. a bad build). */
  @Prop({ type: [String], default: [] })
  declare blockedVersions: string[];

  /** App Store / Google Play page the update prompt opens. */
  @Prop({ type: String, default: '' })
  declare storeUrl: string;

  /** "What's new" shown in the update prompt. */
  @Prop({ type: Object, default: { ar: '', en: '' } })
  declare releaseNotes: { ar: string; en: string };

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.USER })
  declare updatedBy?: Types.ObjectId;

  declare updatedAt?: Date;
}

export type AppVersionPolicyDocument = HydratedDocument<AppVersionPolicy>;
export const AppVersionPolicySchema =
  SchemaFactory.createForClass(AppVersionPolicy);
