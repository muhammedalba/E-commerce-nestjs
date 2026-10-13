import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

// The guards' own import chains (user schema, i18n…) are irrelevant here.
jest.mock('src/auth/shared/guards/auth.guard', () => ({
  AuthGuard: class AuthGuard {},
}));
jest.mock('src/roles/shared/guards/permissions.guard', () => ({
  PermissionsGuard: class PermissionsGuard {},
}));

import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { PERMISSIONS_KEY } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import {
  BackupController,
  BackupDownloadController,
} from './backup.controller';
import { RestoreUploadsDto } from './dto/restore-uploads.dto';
import { UpdateBackupSettingsDto } from './dto/update-backup-settings.dto';

// Same options as the global pipe in main.ts.
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});
const meta: ArgumentMetadata = {
  type: 'body',
  metatype: UpdateBackupSettingsDto,
};
const validate = (body: unknown) => pipe.transform(body, meta);

describe('BackupController access control', () => {
  it('requires authentication and permission checks on every route', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      BackupController,
    ) as unknown[];
    expect(guards).toEqual([AuthGuard, PermissionsGuard]);
  });

  const requiredOf = (method: string) => {
    const handler = Object.getOwnPropertyDescriptor(
      BackupController.prototype,
      method,
    )!.value as object;
    return [Reflect.getMetadata(PERMISSIONS_KEY, handler) as unknown].flat();
  };

  it.each([
    ['getSettings', Permissions.VIEW_BACKUPS],
    ['getStatus', Permissions.VIEW_BACKUPS],
    ['listFiles', Permissions.VIEW_BACKUPS],
    ['getCheck', Permissions.VIEW_BACKUPS],
    ['getTestRestore', Permissions.VIEW_BACKUPS],
    ['updateSettings', Permissions.MANAGE_BACKUP_SETTINGS],
    ['testConnection', Permissions.MANAGE_BACKUP_SETTINGS],
    ['runNow', Permissions.RUN_BACKUP],
    ['verify', Permissions.VERIFY_BACKUP],
    ['testRestore', Permissions.RESTORE_BACKUP_TEST],
    ['dropTestRestore', Permissions.RESTORE_BACKUP_TEST],
    ['restoreUploads', Permissions.RESTORE_BACKUP_FILES],
    ['downloadLink', Permissions.DOWNLOAD_BACKUP],
    ['uploadFile', Permissions.UPLOAD_BACKUP],
    ['deleteUploaded', Permissions.UPLOAD_BACKUP],
  ])('%s requires %s', (method, permission) => {
    expect(requiredOf(method)).toEqual([permission]);
  });

  it('no backup route depends on the settings permissions', () => {
    for (const m of Object.getOwnPropertyNames(BackupController.prototype)) {
      if (m === 'constructor') continue;
      const required = requiredOf(m);
      expect(required).not.toContain(Permissions.VIEW_SETTINGS);
      expect(required).not.toContain(Permissions.UPDATE_SETTINGS);
    }
  });

  it('the token download route has no session guard (the token is the credential)', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, BackupDownloadController),
    ).toBeUndefined();
  });

  it('the token route rejects malformed tokens before any lookup', async () => {
    const files = { streamBundle: jest.fn() };
    const controller = new BackupDownloadController(files as never);
    await expect(controller.download('../../etc', {} as never)).rejects.toThrow(
      /invalid or has expired/,
    );
    expect(files.streamBundle).not.toHaveBeenCalled();
  });
});

describe('UpdateBackupSettingsDto', () => {
  it('accepts a valid partial update', async () => {
    await expect(validate({ backupsPerDay: 6 })).resolves.toEqual({
      backupsPerDay: 6,
    });
    await expect(
      validate({
        enabled: true,
        backupsPerDay: 24,
        scheduleTime: '23:59',
        retentionDays: 90,
        googleDrive: { folderName: 'نسخ احتياطية sky-galaxy' },
      }),
    ).resolves.toBeTruthy();
  });

  it.each([0, -4, 5, 7, 2.5, 48, '4', null])(
    'rejects backupsPerDay=%p',
    async (v) => {
      await expect(validate({ backupsPerDay: v })).rejects.toBeTruthy();
    },
  );

  it.each(['3:00', '24:00', '12:60', '0300', 'noon', 3])(
    'rejects scheduleTime=%p',
    async (v) => {
      await expect(validate({ scheduleTime: v })).rejects.toBeTruthy();
    },
  );

  it.each([0, 1, 15, 365, -7, '14'])('rejects retentionDays=%p', async (v) => {
    await expect(validate({ retentionDays: v })).rejects.toBeTruthy();
  });

  it.each([
    { timezone: 'UTC' },
    { cron: '* * * * *' },
    { googleDrive: { folderId: 'abc' } },
    { googleDrive: { folderName: "a'b" } },
    { googleDrive: { folderName: 'a/b' } },
    { googleDrive: { folderName: '' } },
    { encryptionKey: 'x' },
    { schedulerId: 'other' },
    { enabled: 'yes' },
  ])('rejects %p (no mass assignment)', async (body) => {
    await expect(validate(body)).rejects.toBeTruthy();
  });
});

describe('RestoreUploadsDto', () => {
  const restorePipe = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: RestoreUploadsDto });

  it.each(['preview', 'restore', 'overwrite'])(
    'accepts mode=%s',
    async (mode) => {
      await expect(restorePipe({ mode })).resolves.toEqual({ mode });
    },
  );

  it.each([{}, { mode: 'delete' }, { mode: 'restore', target: '/etc' }])(
    'rejects %p',
    async (body) => {
      await expect(restorePipe(body)).rejects.toBeTruthy();
    },
  );
});
