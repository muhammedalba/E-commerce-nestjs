import { Model, Types } from 'mongoose';
import { RefreshToken } from 'src/auth/shared/schema/refresh-token.schema';
import { DeviceTokensService } from './device-tokens.service';
import { DevicePlatform, DeviceToken } from './schemas/device-token.schema';

const USER = new Types.ObjectId().toString();

/** A chainable stand-in for `Model.find(...)...lean()`. */
function query(result: unknown[]) {
  const chain = {
    sort: () => chain,
    skip: () => chain,
    select: () => chain,
    lean: () => Promise.resolve(result),
  };
  return chain;
}

describe('DeviceTokensService', () => {
  let service: DeviceTokensService;
  let deviceTokenModel: {
    updateOne: jest.Mock;
    deleteOne: jest.Mock;
    deleteMany: jest.Mock;
    find: jest.Mock;
  };
  let refreshTokenModel: { distinct: jest.Mock };

  beforeEach(() => {
    deviceTokenModel = {
      updateOne: jest.fn().mockResolvedValue({}),
      deleteOne: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockReturnValue(query([])),
    };
    refreshTokenModel = { distinct: jest.fn().mockResolvedValue([]) };
    service = new DeviceTokensService(
      deviceTokenModel as unknown as Model<DeviceToken>,
      refreshTokenModel as unknown as Model<RefreshToken>,
    );
  });

  describe('register', () => {
    const device = {
      token: 'fcm-1',
      platform: DevicePlatform.ANDROID,
      lang: 'en' as const,
    };

    it('upserts the token under this user and session', async () => {
      await service.register(USER, 'sid-1', device);

      expect(deviceTokenModel.updateOne).toHaveBeenCalledWith(
        { token: 'fcm-1' },
        {
          $set: expect.objectContaining({
            user: new Types.ObjectId(USER),
            sessionId: 'sid-1',
            platform: 'android',
            lang: 'en',
          }) as unknown,
        },
        { upsert: true },
      );
    });

    it('retries as an update when a concurrent upsert won the race', async () => {
      deviceTokenModel.updateOne
        .mockRejectedValueOnce({ code: 11000 })
        .mockResolvedValueOnce({});

      await service.register(USER, 'sid-1', device);
      expect(deviceTokenModel.updateOne).toHaveBeenCalledTimes(2);
    });

    it('drops the devices beyond the per-user limit', async () => {
      const stale = [{ _id: 'd11' }, { _id: 'd12' }];
      deviceTokenModel.find.mockReturnValue(query(stale));

      await service.register(USER, 'sid-1', device);
      expect(deviceTokenModel.deleteMany).toHaveBeenCalledWith({
        _id: { $in: ['d11', 'd12'] },
      });
    });
  });

  it('unregisters only a token of this user', async () => {
    await service.unregister(USER, 'fcm-1');
    expect(deviceTokenModel.deleteOne).toHaveBeenCalledWith({
      token: 'fcm-1',
      user: new Types.ObjectId(USER),
    });
  });

  describe('activeDevices', () => {
    it('returns only tokens of live sessions and deletes the rest', async () => {
      deviceTokenModel.find.mockReturnValue(
        query([
          { token: 'phone', sessionId: 'live', lang: 'ar' },
          { token: 'old-tablet', sessionId: 'logged-out', lang: 'en' },
        ]),
      );
      refreshTokenModel.distinct.mockResolvedValue(['live']);

      await expect(service.activeDevices(USER)).resolves.toEqual([
        { token: 'phone', lang: 'ar' },
      ]);
      expect(refreshTokenModel.distinct).toHaveBeenCalledWith('sessionId', {
        userId: new Types.ObjectId(USER),
        sessionId: { $in: ['live', 'logged-out'] },
      });
      expect(deviceTokenModel.deleteMany).toHaveBeenCalledWith({
        token: { $in: ['old-tablet'] },
      });
    });

    it('skips the session lookup for a user without devices', async () => {
      await expect(service.activeDevices(USER)).resolves.toEqual([]);
      expect(refreshTokenModel.distinct).not.toHaveBeenCalled();
    });
  });
});
