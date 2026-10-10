import { BadRequestException } from '@nestjs/common';
import { DevicePlatform } from 'src/notifications/push/schemas/device-token.schema';
import {
  AppVersionsService,
  resolveUpdateStatus,
} from './app-versions.service';

const policy = {
  latestVersion: '1.4.0',
  minSupportedVersion: '1.2.0',
  blockedVersions: ['1.3.1'],
};

describe('resolveUpdateStatus', () => {
  it.each([
    ['1.1.9', 'required'],
    ['1.2', 'optional'],
    ['1.2.0', 'optional'],
    ['1.3.1', 'required'],
    ['1.3.1+44', 'required'],
    ['1.3.9', 'optional'],
    ['1.4.0', 'up_to_date'],
    ['1.10.0', 'up_to_date'],
  ])('%s is %s', (version, status) => {
    expect(resolveUpdateStatus(policy, version)).toBe(status);
  });
});

describe('AppVersionsService', () => {
  const stored = {
    platform: DevicePlatform.ANDROID,
    ...policy,
    storeUrl:
      'https://play.google.com/store/apps/details?id=shop.skygalaxy.app',
    releaseNotes: { ar: 'جديد', en: 'New' },
  };

  function createService() {
    const policyModel = {
      findOneAndUpdate: jest
        .fn()
        .mockImplementation(
          (_filter: unknown, update: { $set?: Record<string, unknown> }) => {
            const doc = update.$set ? { ...stored, ...update.$set } : stored;
            const result = Promise.resolve(doc);
            return Object.assign(result, { orFail: () => result });
          },
        ),
    };
    const cache = new Map<string, unknown>();
    const cacheManager = {
      get: jest.fn((k: string) => Promise.resolve(cache.get(k))),
      set: jest.fn((k: string, v: unknown) => {
        cache.set(k, v);
        return Promise.resolve();
      }),
    };
    let version = 0;
    const cacheInvalidation = {
      versionOf: jest.fn(() => `0.${version}`),
      clearResources: jest.fn(() => {
        version++;
        return Promise.resolve();
      }),
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const i18n = {
      translate: jest.fn((key: string) => key),
      translateAll: jest.fn((key: string) => ({ ar: key, en: key })),
    };
    const service = new AppVersionsService(
      policyModel as never,
      cacheManager as never,
      cacheInvalidation as never,
      auditService as never,
      {} as never,
      {} as never,
      i18n as never,
    );
    return { service, policyModel, cacheInvalidation, auditService };
  }

  it('answers a check with the notes in the requested language', async () => {
    const { service } = createService();
    await expect(
      service.check(DevicePlatform.ANDROID, '1.3.0', 'en'),
    ).resolves.toEqual({
      status: 'optional',
      currentVersion: '1.3.0',
      latestVersion: '1.4.0',
      minSupportedVersion: '1.2.0',
      storeUrl: stored.storeUrl,
      releaseNotes: 'New',
    });
  });

  it('serves repeated reads from cache', async () => {
    const { service, policyModel } = createService();
    await service.getPolicy(DevicePlatform.ANDROID);
    await service.getPolicy(DevicePlatform.ANDROID);
    expect(policyModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejects a minimum above the latest version', async () => {
    const { service, auditService } = createService();
    await expect(
      service.updatePolicy(
        DevicePlatform.ANDROID,
        { minSupportedVersion: '1.5.0' },
        { userId: '507f1f77bcf86cd799439011' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('saves, audits and invalidates the cache on update', async () => {
    const { service, cacheInvalidation, auditService } = createService();
    const updated = await service.updatePolicy(
      DevicePlatform.ANDROID,
      { latestVersion: '1.5.0', minSupportedVersion: '1.4.0' },
      { userId: '507f1f77bcf86cd799439011', email: 'admin@x.com' },
    );
    expect(updated.latestVersion).toBe('1.5.0');
    expect(cacheInvalidation.clearResources).toHaveBeenCalledWith([
      'app-versions',
    ]);
    const [entry] = auditService.log.mock.calls[0] as [
      {
        action: string;
        previousData: { latestVersion: string };
        newData: { latestVersion: string };
      },
    ];
    expect(entry.action).toBe('UPDATE_APP_VERSION_POLICY');
    expect(entry.previousData.latestVersion).toBe('1.4.0');
    expect(entry.newData.latestVersion).toBe('1.5.0');
  });
});
