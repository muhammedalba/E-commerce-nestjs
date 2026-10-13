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
import { AuditController } from './audit.controller';
import { AuditLogQueryDto } from './shared/dto/audit-log-query.dto';

// Same options as the global pipe in main.ts.
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});
const meta: ArgumentMetadata = { type: 'query', metatype: AuditLogQueryDto };
const validate = (query: unknown) =>
  pipe.transform(query, meta) as Promise<AuditLogQueryDto>;

describe('AuditController access control', () => {
  it('requires authentication and permission checks on every route', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuditController,
    ) as unknown[];
    expect(guards).toEqual([AuthGuard, PermissionsGuard]);
  });

  const requiredOf = (method: string) => {
    const handler = Object.getOwnPropertyDescriptor(
      AuditController.prototype,
      method,
    )!.value as object;
    return [Reflect.getMetadata(PERMISSIONS_KEY, handler) as unknown].flat();
  };

  it.each([
    ['findAll', Permissions.VIEW_AUDIT_LOGS],
    ['getFilterOptions', Permissions.VIEW_AUDIT_LOGS],
    ['findOne', Permissions.VIEW_AUDIT_LOG_DETAILS],
  ])('%s requires %s', (method, permission) => {
    expect(requiredOf(method)).toEqual([permission]);
  });

  it('exposes no write routes', () => {
    const methods = Object.getOwnPropertyNames(
      AuditController.prototype,
    ).filter((m) => m !== 'constructor');
    expect(methods.sort()).toEqual(['findAll', 'findOne', 'getFilterOptions']);
  });
});

describe('AuditLogQueryDto', () => {
  it('accepts a full, valid query and converts numbers', async () => {
    const dto = await validate({
      page: '2',
      limit: '50',
      module: ' roles ',
      action: 'UPDATE',
      userId: '507f1f77bcf86cd799439011',
      userEmail: 'admin@',
      from: '2026-01-01',
      to: '2026-02-01T00:00:00Z',
    });
    expect(dto).toMatchObject({ page: 2, limit: 50, module: 'roles' });
  });

  it.each([
    [{ limit: '101' }],
    [{ page: '0' }],
    [{ userId: 'not-an-id' }],
    [{ from: 'yesterday' }],
    [{ sort: '-createdAt' }],
    [{ module: { $ne: 'x' } }],
  ])('rejects %o', async (query) => {
    await expect(validate(query)).rejects.toBeDefined();
  });
});
