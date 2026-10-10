import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefreshToken } from 'src/auth/shared/schema/refresh-token.schema';
import { DeviceToken, DevicePlatform } from './schemas/device-token.schema';

/** Oldest registrations beyond this many per user are dropped. */
const MAX_DEVICES_PER_USER = 10;

export interface ActiveDevice {
  token: string;
  lang: 'ar' | 'en';
}

export interface VersionStat {
  platform: DevicePlatform;
  appVersion: string | null;
  devices: number;
}

/**
 * Stores the FCM tokens of the user's app installs.
 *
 * Every token belongs to the login session that registered it, and only
 * tokens of live sessions receive pushes. Logout, a password change, a
 * revoked or expired session or a deleted account therefore stop the pushes
 * of that device without any extra bookkeeping.
 */
@Injectable()
export class DeviceTokensService {
  constructor(
    @InjectModel(DeviceToken.name)
    private readonly deviceTokenModel: Model<DeviceToken>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshToken>,
  ) {}

  /**
   * Registers (or refreshes) a token for this user and session. A token seen
   * before — even under another account on a shared device — moves to them.
   */
  async register(
    userId: string,
    sessionId: string,
    device: {
      token: string;
      platform: DevicePlatform;
      lang: 'ar' | 'en';
      appVersion?: string;
    },
  ): Promise<void> {
    const update = {
      $set: {
        user: new Types.ObjectId(userId),
        sessionId,
        platform: device.platform,
        lang: device.lang,
        lastSeenAt: new Date(),
        ...(device.appVersion && { appVersion: device.appVersion }),
      },
    };
    try {
      await this.deviceTokenModel.updateOne({ token: device.token }, update, {
        upsert: true,
      });
    } catch (err) {
      // Two concurrent upserts of a new token: the loser retries as an update.
      if ((err as { code?: number }).code !== 11000) throw err;
      await this.deviceTokenModel.updateOne({ token: device.token }, update);
    }
    await this.trimDevices(userId);
  }

  /** Removes a token of this user (the app turned notifications off). */
  async unregister(userId: string, token: string): Promise<void> {
    await this.deviceTokenModel.deleteOne({
      token,
      user: new Types.ObjectId(userId),
    });
  }

  /**
   * The user's tokens whose session is still alive. Tokens of ended sessions
   * are deleted on the way.
   */
  async activeDevices(userId: string): Promise<ActiveDevice[]> {
    const user = new Types.ObjectId(userId);
    const devices = await this.deviceTokenModel
      .find({ user })
      .select('token sessionId lang')
      .lean();
    if (!devices.length) return [];

    const liveSessions = new Set(
      await this.refreshTokenModel.distinct('sessionId', {
        userId: user,
        sessionId: { $in: devices.map((d) => d.sessionId) },
      }),
    );

    const ended = devices.filter((d) => !liveSessions.has(d.sessionId));
    if (ended.length) {
      await this.remove(ended.map((d) => d.token));
    }
    return devices
      .filter((d) => liveSessions.has(d.sessionId))
      .map((d) => ({ token: d.token, lang: d.lang }));
  }

  /**
   * Registered installs per platform and app version (`null` = an install
   * that did not report its version), most installs first.
   */
  async versionStats(): Promise<VersionStat[]> {
    return this.deviceTokenModel.aggregate<VersionStat>([
      {
        $group: {
          _id: { platform: '$platform', appVersion: '$appVersion' },
          devices: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          platform: '$_id.platform',
          appVersion: { $ifNull: ['$_id.appVersion', null] },
          devices: 1,
        },
      },
      { $sort: { devices: -1 } },
    ]);
  }

  async remove(tokens: string[]): Promise<void> {
    if (!tokens.length) return;
    await this.deviceTokenModel.deleteMany({ token: { $in: tokens } });
  }

  async removeAllForUser(userId: string): Promise<void> {
    await this.deviceTokenModel.deleteMany({
      user: new Types.ObjectId(userId),
    });
  }

  /** Keeps only the user's most recently seen devices. */
  private async trimDevices(userId: string): Promise<void> {
    const stale = await this.deviceTokenModel
      .find({ user: new Types.ObjectId(userId) })
      .sort({ lastSeenAt: -1 })
      .skip(MAX_DEVICES_PER_USER)
      .select('_id')
      .lean();
    if (stale.length) {
      await this.deviceTokenModel.deleteMany({
        _id: { $in: stale.map((d) => d._id) },
      });
    }
  }
}
