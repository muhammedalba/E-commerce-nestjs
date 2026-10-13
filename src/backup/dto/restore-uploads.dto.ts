import { IsIn } from 'class-validator';
import { RESTORE_UPLOADS_MODES, RestoreUploadsMode } from '../backup.types';

/** Body of `POST /backup/files/:fileId/restore-uploads`. */
export class RestoreUploadsDto {
  @IsIn([...RESTORE_UPLOADS_MODES], {
    message: `mode must be one of ${RESTORE_UPLOADS_MODES.join(', ')}`,
  })
  mode!: RestoreUploadsMode;
}
