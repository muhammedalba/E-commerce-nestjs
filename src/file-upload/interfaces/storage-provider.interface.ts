import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import {
  FileAsset,
  StorageProviderType,
} from 'src/shared/schema/file-asset.schema';

export interface IStorageProvider {
  readonly providerType: StorageProviderType;

  saveFile(
    file: MulterFileType,
    modelName: string,
    dimensions?: { width: number; height: number },
  ): Promise<FileAsset>;

  saveFiles(
    files: MulterFileType[],
    modelName: string,
    dimensions?: { width: number; height: number },
  ): Promise<FileAsset[]>;

  deleteFile(assetOrPath: FileAsset | string): Promise<void>;
  deleteFiles(assetsOrPaths: (FileAsset | string)[]): Promise<void>;
}
