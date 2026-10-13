import { ExecutionContext } from '@nestjs/common';
import { MaintenanceGuard } from './maintenance.guard';

// SettingsService pulls in file-upload → ESM-only `uuid`.
jest.mock('src/settings/settings.service', () => ({
  SettingsService: class {},
}));

const createGuard = () =>
  new MaintenanceGuard(
    {
      getSettings: () =>
        Promise.resolve({ maintenanceMode: true, maintenanceMessage: {} }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

const contextFor = (url: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ url, headers: {} }),
    }),
  }) as unknown as ExecutionContext;

describe('MaintenanceGuard payment routes', () => {
  it.each([
    '/api/v1/payments/webhooks/moyasar',
    '/api/v1/payments/verify/5a1b2c3d-0000-4000-8000-000000000000',
    '/api/v1/payments/verify/pay_1?lang=ar',
  ])('lets %s through during maintenance', async (url) => {
    await expect(createGuard().canActivate(contextFor(url))).resolves.toBe(
      true,
    );
  });

  it.each([
    '/api/v1/orders?next=/payments/verify/x',
    '/api/v1/payments/verify/x/extra',
    '/api/v1/payments/all',
  ])('keeps %s blocked during maintenance', async (url) => {
    await expect(createGuard().canActivate(contextFor(url))).rejects.toThrow();
  });
});

describe('MaintenanceGuard auth routes', () => {
  it.each([
    '/api/v1/auth/login',
    '/api/v1/auth/login/',
    '/api/v1/auth/verify-Pass-Reset-Code',
    '/api/v1/settings',
    '/api/v1/settings?lang=ar',
    '/api/v1/settings/clear-cache',
    '/api/v1/app-versions/check?platform=ios&version=1.0.0',
  ])('lets %s through during maintenance', async (url) => {
    await expect(createGuard().canActivate(contextFor(url))).resolves.toBe(
      true,
    );
  });

  it.each([
    '/api/v1/orders?x=/settings',
    '/api/v1/products?next=/auth/login',
    '/api/v1/users/settings-export',
    '/api/v1/auth/register',
  ])('keeps %s blocked (a query string cannot opt a route in)', async (url) => {
    await expect(createGuard().canActivate(contextFor(url))).rejects.toThrow();
  });
});

describe('MaintenanceGuard backup routes', () => {
  /** A signed-in staff member whose role holds `permissions`. */
  const guardFor = (permissions: string[]) =>
    new MaintenanceGuard(
      {
        getSettings: () =>
          Promise.resolve({ maintenanceMode: true, maintenanceMessage: {} }),
      } as never,
      {
        verifyAsync: () => Promise.resolve({ user_id: 'u1', level: 10 }),
      } as never,
      {
        get: () => Promise.resolve(undefined),
        set: () => Promise.resolve(),
      } as never,
      {
        findById: () => ({
          select: () => ({ lean: () => Promise.resolve({ role: 'role-1' }) }),
        }),
      } as never,
      {
        findById: () => ({
          select: () => ({ lean: () => Promise.resolve({ permissions }) }),
        }),
      } as never,
    );
  const signedIn = (url: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          url,
          headers: { authorization: 'Bearer t' },
        }),
      }),
    }) as unknown as ExecutionContext;

  it('lets roles with a backup permission use the Backups API', async () => {
    await expect(
      guardFor(['run_backup']).canActivate(
        signedIn('/api/v1/backup/files?fresh=1'),
      ),
    ).resolves.toBe(true);
  });

  it('keeps the rest of the store closed to them, and the Backups API to others', async () => {
    await expect(
      guardFor(['run_backup']).canActivate(signedIn('/api/v1/orders')),
    ).rejects.toThrow();
    await expect(
      guardFor(['view_orders']).canActivate(signedIn('/api/v1/backup/files')),
    ).rejects.toThrow();
    await expect(
      guardFor(['run_backup']).canActivate(
        signedIn('/api/v1/orders?next=/backup/files'),
      ),
    ).rejects.toThrow();
  });
});
