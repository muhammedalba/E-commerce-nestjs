import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AppVersionsService } from 'src/app-versions/app-versions.service';
import { isValidAppVersion } from 'src/app-versions/shared/utils/compare-versions';
import { DevicePlatform } from 'src/notifications/push/schemas/device-token.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

/** 426 Upgrade Required (not in Nest's HttpStatus enum). */
export const UPGRADE_REQUIRED = 426;

const PLATFORMS = new Set<string>(Object.values(DevicePlatform));

/**
 * Rejects requests of mobile app versions that must update (below the
 * platform's minimum, or blocked) with **426 Upgrade Required**, so an old
 * install cannot keep using an API that moved on — even if it skips the
 * update screen. The app reacts to 426 by calling `GET app-versions/check`
 * and showing the blocking update screen.
 *
 * Only requests carrying `x-app-platform` and `x-app-version` (sent by the
 * app) are checked: the website, the Next.js server and payment webhooks
 * are never affected.
 */
@Injectable()
export class AppVersionGuard implements CanActivate {
  constructor(
    private readonly appVersions: AppVersionsService,
    private readonly i18n: CustomI18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const platform = request.headers['x-app-platform'];
    const version = request.headers['x-app-version'];

    if (typeof platform !== 'string' || !PLATFORMS.has(platform)) return true;
    if (!isValidAppVersion(version)) return true;
    if (this.isExemptRoute(request.path ?? request.url)) return true;

    const status = await this.appVersions.statusOf(
      platform as DevicePlatform,
      version,
    );
    if (status !== 'required') return true;

    const lang = request.headers['x-lang'] === 'en' ? 'en' : 'ar';
    throw new HttpException(
      this.i18n.translate('exception.APP_UPDATE_REQUIRED', { lang }),
      UPGRADE_REQUIRED,
    );
  }

  /**
   * The version check itself (how the app learns where to update), and the
   * payment settlement routes: a customer returning from 3DS must still
   * have a paid order confirmed.
   */
  private isExemptRoute(url: string): boolean {
    const route =
      url
        .split('?')[0]
        .replace(/^\/api\/v1/, '')
        .replace(/\/+$/, '') || '/';
    return (
      route === '/app-versions/check' ||
      route.endsWith('/payments/webhooks/moyasar') ||
      /^\/payments\/verify\/[^/]+$/.test(route)
    );
  }
}
