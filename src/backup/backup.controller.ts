import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { BackupActor, BackupAdminService } from './backup-admin.service';
import { BackupFilesService } from './backup-files.service';
import { BackupOperationsService } from './backup-operations.service';
import { AllowAnyClient } from 'src/shared/decorators/allow-any-client.decorator';
import { DOWNLOAD_TOKEN_PATTERN } from './backup.types';
import { RestoreUploadsDto } from './dto/restore-uploads.dto';
import { UpdateBackupSettingsDto } from './dto/update-backup-settings.dto';

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: JwtPayload;
}

const actorOf = (req: AuthenticatedRequest): BackupActor => ({
  userId: req.user?.user_id,
  email: req.user?.email,
  ipAddress: req.ip,
});

/**
 * Database backup administration, guarded by the dedicated backup
 * permissions (independent of the settings permissions). No route returns
 * credentials; downloads go through a one-time link (see
 * {@link BackupDownloadController}).
 *
 * | Method | Route | Permission |
 * |--------|-------|------------|
 * | GET | `/backup/settings` | view_backups |
 * | PATCH | `/backup/settings` | manage_backup_settings |
 * | GET | `/backup/status` | view_backups |
 * | POST | `/backup/test-connection` | manage_backup_settings |
 * | POST | `/backup/run` | run_backup |
 * | GET | `/backup/files` | view_backups |
 * | GET | `/backup/checks/:checkId` | view_backups |
 * | POST | `/backup/files/:fileId/verify` | verify_backup |
 * | POST | `/backup/files/:fileId/test-restore` | restore_backup_test |
 * | GET | `/backup/test-restore` | view_backups |
 * | DELETE | `/backup/test-restore` | restore_backup_test |
 * | POST | `/backup/files/:fileId/restore-uploads` | restore_backup_files |
 * | POST | `/backup/files/:fileId/download-link` | download_backup |
 * | POST | `/backup/files/upload` | upload_backup |
 * | DELETE | `/backup/files/:fileId` | upload_backup (uploaded files only) |
 */
@Controller('backup')
@UseGuards(AuthGuard, PermissionsGuard)
export class BackupController {
  constructor(
    private readonly backups: BackupAdminService,
    private readonly operations: BackupOperationsService,
  ) {}

  // ─── settings & status ─────────────────────────────────────────────────────

  @Get('settings')
  @RequirePermission(Permissions.VIEW_BACKUPS)
  getSettings() {
    return this.backups.getSettings();
  }

  @Patch('settings')
  @RequirePermission(Permissions.MANAGE_BACKUP_SETTINGS)
  updateSettings(
    @Body() dto: UpdateBackupSettingsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.backups.updateSettings(dto, actorOf(req));
  }

  @Get('status')
  @RequirePermission(Permissions.VIEW_BACKUPS)
  getStatus() {
    return this.backups.getStatus();
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequirePermission(Permissions.MANAGE_BACKUP_SETTINGS)
  testConnection(@Req() req: AuthenticatedRequest) {
    return this.backups.testConnection(actorOf(req));
  }

  @Post('run')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @RequirePermission(Permissions.RUN_BACKUP)
  runNow(@Req() req: AuthenticatedRequest) {
    return this.backups.runNow(actorOf(req));
  }

  // ─── backups in Drive ──────────────────────────────────────────────────────

  /** `?fresh=1` bypasses the short Drive listing cache (refresh button). */
  @Get('files')
  @RequirePermission(Permissions.VIEW_BACKUPS)
  listFiles(@Query('fresh') fresh?: string) {
    return this.operations.list(fresh === '1');
  }

  @Get('checks/:checkId')
  @RequirePermission(Permissions.VIEW_BACKUPS)
  async getCheck(@Param('checkId') checkId: string) {
    const check = await this.operations.getCheck(checkId);
    if (!check) throw new NotFoundException('Check not found');
    return check;
  }

  @Post('files/upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @RequirePermission(Permissions.UPLOAD_BACKUP)
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.operations.importUpload(file, actorOf(req));
  }

  @Post('files/:fileId/verify')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermission(Permissions.VERIFY_BACKUP)
  verify(@Param('fileId') fileId: string, @Req() req: AuthenticatedRequest) {
    return this.operations.queueVerify(fileId, actorOf(req));
  }

  @Post('files/:fileId/test-restore')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @RequirePermission(Permissions.RESTORE_BACKUP_TEST)
  testRestore(
    @Param('fileId') fileId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.operations.queueTestRestore(fileId, actorOf(req));
  }

  @Post('files/:fileId/restore-uploads')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequirePermission(Permissions.RESTORE_BACKUP_FILES)
  restoreUploads(
    @Param('fileId') fileId: string,
    @Body() dto: RestoreUploadsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.operations.queueRestoreUploads(fileId, dto.mode, actorOf(req));
  }

  @Post('files/:fileId/download-link')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequirePermission(Permissions.DOWNLOAD_BACKUP)
  downloadLink(
    @Param('fileId') fileId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.operations.createDownloadLink(fileId, actorOf(req));
  }

  @Delete('files/:fileId')
  @RequirePermission(Permissions.UPLOAD_BACKUP)
  deleteUploaded(
    @Param('fileId') fileId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.operations.deleteUploaded(fileId, actorOf(req));
  }

  // ─── test restore ──────────────────────────────────────────────────────────

  @Get('test-restore')
  @RequirePermission(Permissions.VIEW_BACKUPS)
  getTestRestore() {
    return this.operations.getTestRestore();
  }

  @Delete('test-restore')
  @RequirePermission(Permissions.RESTORE_BACKUP_TEST)
  dropTestRestore(@Req() req: AuthenticatedRequest) {
    return this.operations.dropTestRestore(actorOf(req));
  }
}

/**
 * `GET /backup/download/:token` — the only backup route without a session:
 * the one-time token (60 s, single use, issued by `download-link` to a user
 * with `download_backup`) is the credential, so the browser's own download
 * manager can stream the bundle to disk. Content is encrypted end to end.
 */
@Controller('backup/download')
@AllowAnyClient()
export class BackupDownloadController {
  constructor(private readonly files: BackupFilesService) {}

  @Get(':token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async download(@Param('token') token: string, @Res() res: Response) {
    if (!DOWNLOAD_TOKEN_PATTERN.test(token)) {
      throw new NotFoundException(
        'This download link is invalid or has expired',
      );
    }
    await this.files.streamBundle(token, res);
  }
}
