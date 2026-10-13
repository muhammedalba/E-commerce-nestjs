import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BackupRunDocument = HydratedDocument<BackupRun>;

export type BackupRunKind = 'backup' | 'connection-test';
export type BackupRunStatus = 'running' | 'succeeded' | 'failed' | 'skipped';

/** Run records are diagnostics only; they expire after 180 days. */
const RUN_TTL_SECONDS = 180 * 24 * 60 * 60;

/**
 * One backup attempt (or Drive connection test). Holds only operational
 * metadata — counts, sizes, ids and a sanitized error — never document
 * contents, credentials or connection strings.
 */
@Schema({ timestamps: true, collection: 'backupruns' })
export class BackupRun {
  @Prop({ type: String, required: true, enum: ['backup', 'connection-test'] })
  declare kind: BackupRunKind;

  @Prop({
    type: String,
    required: true,
    enum: ['running', 'succeeded', 'failed', 'skipped'],
  })
  declare status: BackupRunStatus;

  @Prop({ type: String, default: null })
  declare backupId: string | null;

  @Prop({ type: String, default: null })
  declare jobId: string | null;

  @Prop({ type: String, enum: ['scheduled', 'manual', null], default: null })
  declare trigger: 'scheduled' | 'manual' | null;

  @Prop({ type: Number, default: 1 })
  declare attempt: number;

  @Prop({ type: Date, required: true })
  declare startedAt: Date;

  @Prop({ type: Date, default: null })
  declare finishedAt: Date | null;

  @Prop({ type: Number, default: null })
  declare durationMs: number | null;

  @Prop({ type: String, default: null })
  declare fileName: string | null;

  @Prop({ type: String, default: null })
  declare driveFileId: string | null;

  @Prop({ type: Number, default: null })
  declare sizeBytes: number | null;

  @Prop({ type: Number, default: null })
  declare totalDocs: number | null;

  @Prop({ type: Object, default: null })
  declare collections: Record<string, number> | null;

  @Prop({ type: String, enum: ['snapshot', 'none', null], default: null })
  declare consistency: 'snapshot' | 'none' | null;

  /** Valid backups left in the folder after retention ran. */
  @Prop({ type: Number, default: null })
  declare retainedCount: number | null;

  @Prop({ type: Object, default: null })
  declare retention: {
    deleted: number;
    failed: number;
    uploadManifestsDeleted?: number;
    uploadBlobsDeleted?: number;
  } | null;

  /** Uploads folder backup of this run (null: no local uploads folder). */
  @Prop({ type: Object, default: null })
  declare uploads: {
    manifestId: string;
    files: number;
    totalBytes: number;
    uploadedBlobs: number;
    reusedBlobs: number;
  } | null;

  @Prop({ type: String, default: null })
  declare skipReason: string | null;

  /** Sanitized (see sanitizeError) — never contains credentials. */
  @Prop({ type: String, default: null })
  declare error: string | null;

  createdAt?: Date;
}

export const BackupRunSchema = SchemaFactory.createForClass(BackupRun);

BackupRunSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: RUN_TTL_SECONDS },
);
BackupRunSchema.index({ kind: 1, status: 1, finishedAt: -1 });
