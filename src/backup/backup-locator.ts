import { Injectable, NotFoundException } from '@nestjs/common';
import { BackupSettingsStore } from './backup-settings.store';
import { GoogleDriveClientFactory } from './backup.locks';
import {
  DB_UPLOAD_KIND,
  DRIVE_FILE_ID_PATTERN,
  MANIFEST_UPLOAD_KIND,
  MANUAL_UPLOADS_FOLDER_NAME,
  MANUAL_UPLOADS_FOLDER_ROLE,
} from './backup.types';
import { DriveFile, GoogleDriveClient } from './google-drive.client';
import { BACKUP_KIND_VALUE } from './retention';
import { MANIFEST_KIND } from './uploads/uploads-format';

export interface BackupFolders {
  folderId: string;
  manualFolderId: string | null;
}

export interface ResolvedBackupFile {
  file: DriveFile;
  folders: BackupFolders;
  /** Uploaded from a device (manual-uploads) rather than made by the server. */
  uploaded: boolean;
  backupId: string;
}

/**
 * Finds the app's backup folders in Drive and resolves file ids sent by the
 * admin UI — only to database backup files inside those folders.
 */
@Injectable()
export class BackupLocator {
  constructor(
    private readonly store: BackupSettingsStore,
    private readonly driveFactory: GoogleDriveClientFactory,
  ) {}

  drive(): GoogleDriveClient {
    return this.driveFactory.create();
  }

  /**
   * The backup folder (+ manual-uploads subfolder). Read-only by default:
   * null when no backup folder exists yet. With `create`, both are created
   * if missing (callers serialize this with the backup lock).
   */
  async folders(
    drive: GoogleDriveClient,
    opts: { create?: boolean } = {},
  ): Promise<BackupFolders | null> {
    const settings = await this.store.get();
    const { folderName, folderId: storedId } = settings.googleDrive;
    let folderId: string | null;
    if (opts.create) {
      folderId = (await drive.ensureFolder(folderName, storedId || undefined))
        .id;
    } else {
      folderId = (await drive.testConnection(folderName, storedId || undefined))
        .folderId;
    }
    if (!folderId) return null;
    if (folderId !== storedId) await this.store.setFolderId(folderId);

    const manualOpts = {
      role: MANUAL_UPLOADS_FOLDER_ROLE,
      parentId: folderId,
    };
    const manualFolderId = opts.create
      ? (
          await drive.ensureFolder(
            MANUAL_UPLOADS_FOLDER_NAME,
            undefined,
            manualOpts,
          )
        ).id
      : ((await drive.findFolders(MANUAL_UPLOADS_FOLDER_NAME, manualOpts))[0]
          ?.id ?? null);
    return { folderId, manualFolderId };
  }

  allowedDbFiles(f: BackupFolders): { folderId: string; kind: string }[] {
    return [
      { folderId: f.folderId, kind: BACKUP_KIND_VALUE },
      ...(f.manualFolderId
        ? [{ folderId: f.manualFolderId, kind: DB_UPLOAD_KIND }]
        : []),
    ];
  }

  /** A database backup file the UI may act on, or 404. */
  async resolveDbFile(
    drive: GoogleDriveClient,
    fileId: string,
  ): Promise<ResolvedBackupFile> {
    const notFound = () => new NotFoundException('Backup file not found');
    if (!DRIVE_FILE_ID_PATTERN.test(fileId)) throw notFound();
    const folders = await this.folders(drive);
    if (!folders) throw notFound();
    const file = await drive.getBackupFile(
      fileId,
      this.allowedDbFiles(folders),
    );
    const backupId = file?.appProperties?.sgbkBackupId;
    if (!file || !backupId) throw notFound();
    const uploaded =
      file.appProperties?.sgbkKind === DB_UPLOAD_KIND &&
      !!folders.manualFolderId &&
      (file.parents ?? []).includes(folders.manualFolderId);
    return { file, folders, uploaded, backupId };
  }

  /** The uploads manifest that belongs with a database backup file, if any. */
  async findManifest(
    drive: GoogleDriveClient,
    resolved: Pick<ResolvedBackupFile, 'folders' | 'uploaded' | 'backupId'>,
  ): Promise<DriveFile | null> {
    const { folders, uploaded, backupId } = resolved;
    const folderId = uploaded ? folders.manualFolderId : folders.folderId;
    if (!folderId) return null;
    const manifests = await drive.listFiles(
      folderId,
      uploaded ? MANIFEST_UPLOAD_KIND : MANIFEST_KIND,
    );
    return (
      manifests.find((m) => m.appProperties?.sgbkBackupId === backupId) ?? null
    );
  }
}
