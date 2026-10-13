import { DriveFile, GoogleDriveClient } from '../google-drive.client';
import {
  BLOBS_FOLDER_NAME,
  BLOBS_FOLDER_ROLE,
  BLOB_ID_PROPERTY,
  BLOB_KIND,
} from './uploads-format';

type BlobDrive = Pick<
  GoogleDriveClient,
  'findFolders' | 'ensureFolder' | 'listFiles'
>;

export interface BlobIndex {
  /** The shared `uploads-blobs` folder, or null if it does not exist (yet). */
  folderId: string | null;
  /** Blob files in it, by blob id. */
  files: Map<string, DriveFile>;
}

/**
 * The shared blobs folder inside a backup folder and the blobs it holds.
 * With `create`, the folder is created when missing (callers that write
 * hold the backup lock).
 */
export async function loadBlobIndex(
  drive: BlobDrive,
  backupFolderId: string,
  opts: { create?: boolean } = {},
): Promise<BlobIndex> {
  const folderOpts = { role: BLOBS_FOLDER_ROLE, parentId: backupFolderId };
  const folderId = opts.create
    ? (await drive.ensureFolder(BLOBS_FOLDER_NAME, undefined, folderOpts)).id
    : ((await drive.findFolders(BLOBS_FOLDER_NAME, folderOpts))[0]?.id ?? null);
  const files = new Map<string, DriveFile>();
  if (folderId) {
    for (const f of await drive.listFiles(folderId, BLOB_KIND)) {
      const id = f.appProperties?.[BLOB_ID_PROPERTY];
      if (id) files.set(id, f);
    }
  }
  return { folderId, files };
}
