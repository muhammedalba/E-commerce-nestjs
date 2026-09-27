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
