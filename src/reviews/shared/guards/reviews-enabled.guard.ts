import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { SettingsService } from 'src/settings/settings.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

/**
 * Blocks creating/editing reviews when the admin has disabled reviews
 * from the store settings (`settings.features.reviews`).
 *
 * Settings are read through {@link SettingsService["getSettings"]} (cached),
 * so this guard adds no DB round-trip on the hot path.
 */
@Injectable()
export class ReviewsEnabledGuard implements CanActivate {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly i18n: CustomI18nService,
  ) {}

  async canActivate(): Promise<boolean> {
    if (!(await this.settingsService.isReviewsEnabled())) {
      throw new ForbiddenException(
        this.i18n.translate('exception.review.REVIEWS_DISABLED'),
      );
    }
    return true;
  }
}
