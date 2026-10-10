import { ExecutionContext, HttpException } from '@nestjs/common';
import { AppVersionGuard, UPGRADE_REQUIRED } from './app-version.guard';

function createGuard(status = 'required') {
  const appVersions = { statusOf: jest.fn().mockResolvedValue(status) };
  const i18n = { translate: jest.fn(() => 'Please update the app') };
  return {
    guard: new AppVersionGuard(appVersions as never, i18n as never),
    appVersions,
  };
}

function contextFor(url: string, headers: Record<string, string> = {}) {
  const request = { url, path: url.split('?')[0], headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const oldApp = { 'x-app-platform': 'android', 'x-app-version': '0.9.0' };

describe('AppVersionGuard', () => {
  it('ignores requests without app headers (website, webhooks)', async () => {
    const { guard, appVersions } = createGuard();
    await expect(
      guard.canActivate(contextFor('/api/v1/products')),
    ).resolves.toBe(true);
    expect(appVersions.statusOf).not.toHaveBeenCalled();
  });

  it.each([
    { 'x-app-platform': 'windows', 'x-app-version': '0.9.0' },
    { 'x-app-platform': 'ios', 'x-app-version': 'not-a-version' },
  ])('ignores unknown header values %o', async (headers) => {
    const { guard } = createGuard();
    await expect(
      guard.canActivate(contextFor('/api/v1/products', headers)),
    ).resolves.toBe(true);
  });

  it('rejects an install that must update with 426', async () => {
    const { guard, appVersions } = createGuard('required');
    const attempt = guard.canActivate(contextFor('/api/v1/products', oldApp));
    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await attempt.catch((err: HttpException) =>
      expect(err.getStatus()).toBe(UPGRADE_REQUIRED),
    );
    expect(appVersions.statusOf).toHaveBeenCalledWith('android', '0.9.0');
  });

  it.each(['optional', 'up_to_date'])(
    'lets a %s install through',
    async (s) => {
      const { guard } = createGuard(s);
      await expect(
        guard.canActivate(contextFor('/api/v1/products', oldApp)),
      ).resolves.toBe(true);
    },
  );

  it.each([
    '/api/v1/app-versions/check?platform=android&version=0.9.0',
    '/api/v1/payments/webhooks/moyasar',
    '/api/v1/payments/verify/abc123',
  ])('always lets %s through', async (url) => {
    const { guard, appVersions } = createGuard('required');
    await expect(guard.canActivate(contextFor(url, oldApp))).resolves.toBe(
      true,
    );
    expect(appVersions.statusOf).not.toHaveBeenCalled();
  });
});
