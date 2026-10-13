import { ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BACKUP_PERMISSIONS,
  PERMISSIONS_METADATA,
  Permissions,
  expandPermissions,
} from '../enums/permissions.enum';
import { PermissionsGuard } from './permissions.guard';

interface PermissionsJson {
  groups: Record<string, string>;
  labels: Record<string, string>;
}
const i18n = (lang: string) =>
  JSON.parse(
    readFileSync(
      join(__dirname, '../../../i18n', lang, 'permissions.json'),
      'utf8',
    ),
  ) as PermissionsJson;
const arPermissions = i18n('ar');
const enPermissions = i18n('en');

function guardFor(
  rolePermissions: Permissions[],
  required: Permissions[],
  cache = new Map<string, unknown>(),
) {
  const guard = new PermissionsGuard(
    { getAllAndOverride: () => required } as never,
    {
      get: (k: string) => Promise.resolve(cache.get(k)),
      set: (k: string, v: unknown) => Promise.resolve(void cache.set(k, v)),
    } as never,
    {} as never,
    {
      findById: () => ({
        select: () => ({
          lean: () => Promise.resolve({ permissions: [...rolePermissions] }),
        }),
      }),
    } as never,
    { translate: (k: string) => k } as never,
  );
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: { level: 10, roleId: 'role-1' } }),
    }),
  };
  return () => guard.canActivate(ctx as never);
}

describe('backup permissions', () => {
  it('are separate from the settings permissions', () => {
    expect(BACKUP_PERMISSIONS).toEqual([
      'view_backups',
      'manage_backup_settings',
      'run_backup',
      'verify_backup',
      'restore_backup_test',
      'restore_backup_files',
      'download_backup',
      'upload_backup',
    ]);
    expect(BACKUP_PERMISSIONS).not.toContain(Permissions.UPDATE_SETTINGS);
  });

  it('have their own group and translated labels in both languages', () => {
    for (const key of BACKUP_PERMISSIONS) {
      const meta = PERMISSIONS_METADATA.find((m) => m.key === key);
      expect(meta).toMatchObject({
        groupKey: 'permissions.groups.backups',
        labelKey: `permissions.labels.${key}`,
      });
      for (const json of [arPermissions, enPermissions]) {
        expect(json.labels[key]).toBeTruthy();
        expect(json.groups.backups).toBeTruthy();
      }
    }
  });

  it('any backup permission implies view_backups', async () => {
    await expect(
      guardFor([Permissions.RUN_BACKUP], [Permissions.VIEW_BACKUPS])(),
    ).resolves.toBe(true);
  });

  it('settings permissions do not grant backup access', async () => {
    await expect(
      guardFor(
        [Permissions.VIEW_SETTINGS, Permissions.UPDATE_SETTINGS],
        [Permissions.VIEW_BACKUPS],
      )(),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('view_backups alone does not allow actions', async () => {
    await expect(
      guardFor([Permissions.VIEW_BACKUPS], [Permissions.DOWNLOAD_BACKUP])(),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies the implication to permissions cached by other readers', async () => {
    // /roles/my-permissions and the maintenance guard share this cache entry.
    const cache = new Map<string, unknown>([
      ['role_permissions:role-1', [Permissions.RUN_BACKUP]],
    ]);
    await expect(
      guardFor([], [Permissions.VIEW_BACKUPS], cache)(),
    ).resolves.toBe(true);
  });

  it('expandPermissions adds only the implied permissions', () => {
    expect(expandPermissions([Permissions.VERIFY_BACKUP]).sort()).toEqual(
      [Permissions.VERIFY_BACKUP, Permissions.VIEW_BACKUPS].sort(),
    );
    expect(expandPermissions([Permissions.UPDATE_SETTINGS]).sort()).toEqual(
      [Permissions.UPDATE_SETTINGS, Permissions.VIEW_SETTINGS].sort(),
    );
    expect(expandPermissions([Permissions.VIEW_SETTINGS])).toEqual([
      Permissions.VIEW_SETTINGS,
    ]);
    expect(expandPermissions(undefined)).toEqual([]);
  });
});
