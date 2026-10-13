import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BackupCheckDocument = HydratedDocument<BackupCheck>;
export type BackupCheckKind =
  'verify' | 'test-restore' | 'restore-uploads' | 'import';
export type BackupCheckStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** Kept 180 days, like run records. */
const CHECK_TTL_SECONDS = 180 * 24 * 60 * 60;

/**
 * A verification or test-restore of one backup file. Operational metadata
 * only (counts, ids, sanitized errors) — never document contents.
 */
@Schema({ timestamps: true, collection: 'backupchecks' })
export class BackupCheck {
  @Prop({
    type: String,
    required: true,
    enum: ['verify', 'test-restore', 'restore-uploads', 'import'],
  })
  declare kind: BackupCheckKind;

  @Prop({
    type: String,
    required: true,
    enum: ['queued', 'running', 'succeeded', 'failed'],
  })
  declare status: BackupCheckStatus;

  /** The backup file in Drive (an import sets it once the file is uploaded). */
  @Prop({ type: String, default: null })
  declare driveFileId: string | null;

  @Prop({ type: String, default: null })
  declare backupId: string | null;

  @Prop({ type: String, enum: ['auto', 'manual'], default: 'manual' })
  declare trigger: 'auto' | 'manual';

  @Prop({ type: String, default: null })
  declare requestedBy: string | null;

  @Prop({ type: String, default: null })
  declare jobId: string | null;

  /** restore-uploads: preview | restore | overwrite. */
  @Prop({ type: String, default: null })
  declare mode: string | null;

  /** Test restore: documents restored so far / total (restore-uploads: files). */
  @Prop({ type: Object, default: null })
  declare progress: { done: number; total: number } | null;

  @Prop({ type: Object, default: null })
  declare report: Record<string, unknown> | null;

  /** Test restore: the slot database was dropped since. */
  @Prop({ type: Boolean, default: false })
  declare dropped: boolean;

  @Prop({ type: String, default: null })
  declare error: string | null;

  @Prop({ type: Date, default: null })
  declare startedAt: Date | null;

  @Prop({ type: Date, default: null })
  declare finishedAt: Date | null;

  createdAt?: Date;
}

export const BackupCheckSchema = SchemaFactory.createForClass(BackupCheck);

BackupCheckSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: CHECK_TTL_SECONDS },
);
BackupCheckSchema.index({ driveFileId: 1, kind: 1, createdAt: -1 });
BackupCheckSchema.index({ kind: 1, createdAt: -1 });
