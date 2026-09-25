import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { SettingsService } from 'src/settings/settings.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

/**
 * Blocks adding/syncing wishlist items when the admin has disabled the wishlist
 * from the store settings (`settings.features.wishlist`).
 *
 * Settings are read through {@link SettingsService["getSettings"]} (cached),
 * so this guard adds no DB round-trip on the hot path.
 */
@Injectable()
export class WishlistEnabledGuard implements CanActivate {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly i18n: CustomI18nService,
  ) {}

  async canActivate(): Promise<boolean> {
    if (!(await this.settingsService.isWishlistEnabled())) {
      throw new ForbiddenException(
        this.i18n.translate('exception.wishlist.WISHLIST_DISABLED'),
      );
    }
    return true;
  }
}
