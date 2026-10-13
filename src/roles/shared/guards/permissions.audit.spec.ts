import { ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AUDIT_PERMISSIONS,
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

describe('audit permissions', () => {
  it('are view-only (no edit or delete permission exists)', () => {
    expect(AUDIT_PERMISSIONS).toEqual([
      'view_audit_logs',
      'view_audit_log_details',
    ]);
  });

  it('have their own group and translated labels in both languages', () => {
    for (const key of AUDIT_PERMISSIONS) {
      const meta = PERMISSIONS_METADATA.find((m) => m.key === key);
      expect(meta).toMatchObject({
        groupKey: 'permissions.groups.audit',
        labelKey: `permissions.labels.${key}`,
      });
      for (const json of [arPermissions, enPermissions]) {
        expect(json.labels[key]).toBeTruthy();
        expect(json.groups.audit).toBeTruthy();
      }
    }
  });

  it('view_audit_log_details implies view_audit_logs', async () => {
    await expect(
      guardFor(
        [Permissions.VIEW_AUDIT_LOG_DETAILS],
        [Permissions.VIEW_AUDIT_LOGS],
      )(),
    ).resolves.toBe(true);
    expect(
      expandPermissions([Permissions.VIEW_AUDIT_LOG_DETAILS]).sort(),
    ).toEqual(
      [Permissions.VIEW_AUDIT_LOG_DETAILS, Permissions.VIEW_AUDIT_LOGS].sort(),
    );
  });

  it('view_audit_logs alone does not reveal entry details', async () => {
    await expect(
      guardFor(
        [Permissions.VIEW_AUDIT_LOGS],
        [Permissions.VIEW_AUDIT_LOG_DETAILS],
      )(),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('other admin permissions do not grant audit access', async () => {
    await expect(
      guardFor(
        [
          Permissions.VIEW_ROLES,
          Permissions.UPDATE_SETTINGS,
          Permissions.VIEW_BACKUPS,
        ],
        [Permissions.VIEW_AUDIT_LOGS],
      )(),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
