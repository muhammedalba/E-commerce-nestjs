import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export type StorageProviderType = 'local' | 'cloudinary';

export interface FileAsset {
  url: string;
  publicId: string;
  provider: StorageProviderType;
}

@Schema({ _id: false })
export class FileAssetDocument implements FileAsset {
  @Prop({ type: String, required: true, trim: true })
  @IsString()
  @IsNotEmpty()
  declare url: string;

  @Prop({ type: String, required: true, trim: true })
  @IsString()
  @IsNotEmpty()
  declare publicId: string;

  @Prop({
    type: String,
    enum: ['local', 'cloudinary'],
    default: 'local',
    required: true,
  })
  @IsIn(['local', 'cloudinary'])
  declare provider: StorageProviderType;
}

export const FileAssetSchema = SchemaFactory.createForClass(FileAssetDocument);
