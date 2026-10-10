import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Cache } from 'cache-manager';
import { Model, Types } from 'mongoose';
import { AuditService } from 'src/audit/audit.service';
import { DeviceTokensService } from 'src/notifications/push/device-tokens.service';
import { appUpdateTopic } from 'src/notifications/push/push.constants';
import { PushNotificationsService } from 'src/notifications/push/push-notifications.service';
import { DevicePlatform } from 'src/notifications/push/schemas/device-token.schema';
import { CacheInvalidationService } from 'src/shared/services/cache-invalidation.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { UpdateAppVersionDto } from './shared/dto/update-app-version.dto';
import { AppVersionPolicy } from './shared/schemas/app-version-policy.schema';
import { compareVersions } from './shared/utils/compare-versions';

/** Cache resource of the policies; its version is part of every cache key. */
export const APP_VERSIONS_CACHE_RESOURCE = 'app-versions';
const POLICY_CACHE_TTL = 60 * 60 * 1000; // 1 h — writes invalidate it anyway

/**
 * - `required`: the install is no longer supported and must update.
 * - `optional`: a newer version is live; the user may update later.
 * - `up_to_date`: nothing to do.
 */
export type UpdateStatus = 'up_to_date' | 'optional' | 'required';

export interface AppVersionPolicyView {
  platform: DevicePlatform;
  latestVersion: string;
  minSupportedVersion: string;
  blockedVersions: string[];
  storeUrl: string;
  releaseNotes: { ar: string; en: string };
  updatedAt?: Date;
}

/** Update status of `version` under `policy` (pure: shared by API and guard). */
export function resolveUpdateStatus(
  policy: Pick<
    AppVersionPolicyView,
    'latestVersion' | 'minSupportedVersion' | 'blockedVersions'
  >,
  version: string,
): UpdateStatus {
  if (
    compareVersions(version, policy.minSupportedVersion) < 0 ||
    policy.blockedVersions.some((v) => compareVersions(v, version) === 0)
  ) {
    return 'required';
  }
  if (compareVersions(version, policy.latestVersion) < 0) return 'optional';
  return 'up_to_date';
}

interface Actor {
  userId: string;
  email?: string;
  ipAddress?: string;
}

/**
 * Update policy of the mobile apps: tells an install whether it may or must
 * update, and lets admins publish a new version per platform.
 */
@Injectable()
export class AppVersionsService {
  constructor(
    @InjectModel(AppVersionPolicy.name)
    private readonly policyModel: Model<AppVersionPolicy>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly auditService: AuditService,
    private readonly deviceTokens: DeviceTokensService,
    private readonly push: PushNotificationsService,
    private readonly i18n: CustomI18nService,
  ) {}

  /**
   * The platform's policy, from cache. Created with defaults on first read
   * (`1.0.0` everywhere: no install is asked to update).
   */
  async getPolicy(platform: DevicePlatform): Promise<AppVersionPolicyView> {
    const key = this.cacheKey(platform);
    const cached = await this.cacheManager.get<AppVersionPolicyView>(key);
    if (cached) return cached;

    const policy = toView(await this.upsertDefaults(platform));
    await this.cacheManager.set(key, policy, POLICY_CACHE_TTL);
    return policy;
  }

  async getAllPolicies(): Promise<AppVersionPolicyView[]> {
    return Promise.all(
      Object.values(DevicePlatform).map((p) => this.getPolicy(p)),
    );
  }

  async statusOf(
    platform: DevicePlatform,
    version: string,
  ): Promise<UpdateStatus> {
    return resolveUpdateStatus(await this.getPolicy(platform), version);
  }

  /** Answer of `GET app-versions/check`, release notes in `lang`. */
  async check(platform: DevicePlatform, version: string, lang: 'ar' | 'en') {
    const policy = await this.getPolicy(platform);
    return {
      status: resolveUpdateStatus(policy, version),
      currentVersion: version,
      latestVersion: policy.latestVersion,
      minSupportedVersion: policy.minSupportedVersion,
      storeUrl: policy.storeUrl,
      releaseNotes: policy.releaseNotes[lang] ?? '',
    };
  }

  /** Applies an admin change, audits it and drops the cached policy. */
  async updatePolicy(
    platform: DevicePlatform,
    dto: UpdateAppVersionDto,
    actor: Actor,
  ): Promise<AppVersionPolicyView> {
    const previous = toView(await this.upsertDefaults(platform));
    const next = { ...previous, ...dto };

    if (compareVersions(next.minSupportedVersion, next.latestVersion) > 0) {
      throw new BadRequestException(
        this.i18n.translate('exception.APP_MIN_VERSION_ABOVE_LATEST'),
      );
    }

    const updated = await this.policyModel
      .findOneAndUpdate(
        { platform },
        { $set: { ...dto, updatedBy: new Types.ObjectId(actor.userId) } },
        { new: true, lean: true },
      )
      .orFail();

    await this.cacheInvalidation.clearResources([APP_VERSIONS_CACHE_RESOURCE]);
    await this.auditService.log({
      action: 'UPDATE_APP_VERSION_POLICY',
      module: 'app-versions',
      userId: actor.userId,
      userEmail: actor.email,
      ipAddress: actor.ipAddress,
      previousData: previous,
      newData: toView(updated),
    });
    return toView(updated);
  }

  /**
   * Pushes "a new version is available" to every install of the platform
   * subscribed to its update topic (logged-in or not).
   */
  async announce(platform: DevicePlatform): Promise<void> {
    const policy = await this.getPolicy(platform);
    const args = { version: policy.latestVersion };
    const sent = await this.push.sendToTopic(appUpdateTopic(platform), {
      title: this.i18n.translateAll('notification.PUSH_TITLE_APP_UPDATE'),
      body: this.i18n.translateAll('notification.APP_UPDATE_AVAILABLE', {
        args,
      }),
      data: {
        type: 'app_update',
        version: policy.latestVersion,
        storeUrl: policy.storeUrl,
      },
      collapseKey: 'app_update',
    });
    if (!sent) {
      throw new ServiceUnavailableException(
        this.i18n.translate('exception.PUSH_UNAVAILABLE'),
      );
    }
  }

  /**
   * Registered installs per version, with the share each platform policy
   * would force to update — check it before raising `minSupportedVersion`.
   */
  async stats() {
    const [rows, policies] = await Promise.all([
      this.deviceTokens.versionStats(),
      this.getAllPolicies(),
    ]);
    return policies.map((policy) => {
      const versions = rows
        .filter((r) => r.platform === policy.platform)
        .map((r) => ({
          ...r,
          status: r.appVersion
            ? resolveUpdateStatus(policy, r.appVersion)
            : null,
        }));
      const count = (status: UpdateStatus) =>
        versions
          .filter((v) => v.status === status)
          .reduce((sum, v) => sum + v.devices, 0);
      return {
        platform: policy.platform,
        totalDevices: versions.reduce((sum, v) => sum + v.devices, 0),
        required: count('required'),
        optional: count('optional'),
        upToDate: count('up_to_date'),
        versions,
      };
    });
  }

  private async upsertDefaults(platform: DevicePlatform) {
    const find = () =>
      this.policyModel
        .findOneAndUpdate(
          { platform },
          { $setOnInsert: { platform } },
          { upsert: true, new: true, lean: true },
        )
        .orFail();
    try {
      return await find();
    } catch (err) {
      // Two concurrent first reads: the loser reads the winner's document.
      if ((err as { code?: number }).code !== 11000) throw err;
      return await find();
    }
  }

  private cacheKey(platform: DevicePlatform): string {
    return `${APP_VERSIONS_CACHE_RESOURCE}:${platform}:${this.cacheInvalidation.versionOf(APP_VERSIONS_CACHE_RESOURCE)}`;
  }
}

function toView(doc: AppVersionPolicy): AppVersionPolicyView {
  return {
    platform: doc.platform,
    latestVersion: doc.latestVersion,
    minSupportedVersion: doc.minSupportedVersion,
    blockedVersions: doc.blockedVersions ?? [],
    storeUrl: doc.storeUrl ?? '',
    releaseNotes: doc.releaseNotes ?? { ar: '', en: '' },
    updatedAt: doc.updatedAt,
  };
}
