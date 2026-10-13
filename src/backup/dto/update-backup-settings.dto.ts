import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  FOLDER_NAME_PATTERN,
  SCHEDULE_TIME_PATTERN,
  SUPPORTED_BACKUPS_PER_DAY,
  SUPPORTED_RETENTION_DAYS,
} from '../backup.types';

/** Optional, but an explicit null is rejected (it would erase the value). */
const Optional = () => ValidateIf((_o, value) => value !== undefined);

class BackupGoogleDriveDto {
  @Optional()
  @IsString()
  @Matches(FOLDER_NAME_PATTERN, {
    message:
      'folderName must be 1-100 characters without quotes, slashes or control characters',
  })
  folderName?: string;
}

/**
 * Body of `PATCH /backup/settings`. Every field is optional (partial update).
 * Only these fields are accepted: the global pipe's `forbidNonWhitelisted`
 * rejects anything else (timezone, folderId, cron, job ids, credentials…).
 */
export class UpdateBackupSettingsDto {
  @Optional()
  @IsBoolean()
  enabled?: boolean;

  @Optional()
  @IsInt()
  @IsIn([...SUPPORTED_BACKUPS_PER_DAY], {
    message: `backupsPerDay must be one of ${SUPPORTED_BACKUPS_PER_DAY.join(', ')}`,
  })
  backupsPerDay?: number;

  @Optional()
  @IsString()
  @Matches(SCHEDULE_TIME_PATTERN, {
    message: 'scheduleTime must be a 24-hour time HH:mm',
  })
  scheduleTime?: string;

  @Optional()
  @IsInt()
  @IsIn([...SUPPORTED_RETENTION_DAYS], {
    message: `retentionDays must be one of ${SUPPORTED_RETENTION_DAYS.join(', ')}`,
  })
  retentionDays?: number;

  @Optional()
  @ValidateNested()
  @Type(() => BackupGoogleDriveDto)
  googleDrive?: BackupGoogleDriveDto;
}
