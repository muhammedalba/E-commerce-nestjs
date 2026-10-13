import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Local file → blob id cache, so unchanged files (same size + mtime + key)
 * are not re-read and re-hashed on every backup. Only a speed-up: losing it
 * just means the next run hashes everything again.
 */
@Schema({ collection: 'backupuploadindex', timestamps: true })
export class BackupUploadIndex {
  @Prop({ type: String, required: true, unique: true })
  declare path: string;

  @Prop({ type: Number, required: true })
  declare size: number;

  @Prop({ type: Number, required: true })
  declare mtimeMs: number;

  @Prop({ type: String, required: true })
  declare blob: string;

  @Prop({ type: String, required: true })
  declare keyId: string;
}
export type BackupUploadIndexDocument = HydratedDocument<BackupUploadIndex>;
export const BackupUploadIndexSchema =
  SchemaFactory.createForClass(BackupUploadIndex);

/**
 * Blob ids referenced by each uploads manifest in Drive, so retention can
 * find unreferenced blobs without downloading every manifest. Rebuilt from
 * Drive (download + decrypt) for any manifest missing here.
 */
@Schema({ collection: 'backupuploadmanifests', timestamps: true })
export class BackupUploadManifest {
  @Prop({ type: String, required: true, unique: true })
  declare driveFileId: string;

  @Prop({ type: String, required: true })
  declare backupId: string;

  @Prop({ type: [String], default: [] })
  declare blobs: string[];
}
export type BackupUploadManifestDocument =
  HydratedDocument<BackupUploadManifest>;
export const BackupUploadManifestSchema =
  SchemaFactory.createForClass(BackupUploadManifest);
