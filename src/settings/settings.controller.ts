import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './shared/dto/update-setting.dto';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ParseBodyJsonInterceptor } from 'src/shared/interceptors/parse-body-json.interceptor';
import { ParseFileFieldsPipe } from 'src/shared/files/ParseFileFieldsPipe';

/**
 * Controller that exposes the application-wide settings API.
 *
 * Base route: `PATCH /settings`
 *
 * | Method | Route | Access | Description |
 * |--------|-------|--------|-------------|
 * | GET | `/settings` | Public | Retrieve current settings |
 * | PATCH | `/settings` | Admin | Update settings (with optional file uploads) |
 * | PATCH | `/settings/clear-cache` | Admin | Flush server-side settings cache |
 *
 * @remarks
 * The controller is decorated with {@link ClearCacheInterceptor} at the class
 * level, which automatically removes relevant cache entries after every
 * mutating request.
 */
@Controller('settings')
@UseInterceptors(ClearCacheInterceptor)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Accepted file upload fields for image assets.
   * Each field is limited to a single file (`maxCount: 1`).
   */
  private static readonly imageSize = [
    { name: 'favicon', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /settings
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns the current global application settings.
   *
   * **Access:** Public – no authentication required.
   *
   * **Caching:** Responses are cached by {@link CustomCacheInterceptor} for
   * 1 hour (`3 600 000 ms`). The cache is automatically invalidated whenever
   * settings are updated or {@link clearCache} is called.
   *
   * @returns The global {@link Setting} object, served from cache when available.
   *
   * @example
   * ```http
   * GET /settings
   * ```
   */
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(3600000) // 1 hour
  async getSettings() {
    return await this.settingsService.getSettings();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /settings/google-reviews
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns the store's Google reviews (via Google Places API) when the admin
   * has enabled them in settings.
   *
   * **Access:** Public – no authentication required.
   *
   * **Caching:** Handled inside {@link SettingsService.getGoogleReviews}
   * (24 h per language) and invalidated whenever settings are updated.
   *
   * @param lang - Review language (`ar` | `en`). Defaults to `ar`.
   *
   * @example
   * ```http
   * GET /settings/google-reviews?lang=en
   * ```
   */
  @Get('google-reviews')
  async getGoogleReviews(@Query('lang') lang?: string) {
    return await this.settingsService.getGoogleReviews(
      lang === 'en' ? 'en' : 'ar',
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /settings
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Updates the global application settings.
   *
   * **Access:** Admin only – requires the `UPDATE_SETTINGS` permission.
   *
   * **Request format:** `multipart/form-data` (to support file uploads).
   * Complex JSON fields (e.g. `socialLinks`, `contactInfo`) must be sent as
   * serialised JSON strings; they are automatically parsed by
   * {@link ParseBodyJsonInterceptor}.
   *
   * **File uploads:**
   * - `favicon` – Site favicon. Max size: 1 MB. Accepted: `png`, `jpeg`, `webp`, `pdf`.
   * - `logo`    – Site logo.    Max size: 1 MB. Accepted: `png`, `jpeg`, `webp`, `pdf`.
   *
   * Both file fields are optional. To explicitly **delete** an existing image,
   * send the corresponding DTO field with the value `"null"` (string) or `null`.
   *
   * **Side effects:**
   * - Invalidates the server-side settings cache.
   * - Triggers Next.js ISR revalidation for the `settings` and
   *   `public-settings` cache tags.
   *
   * @param files           - Uploaded files grouped by field name.
   * @param updateSettingDto - Validated update payload.
   * @returns The updated {@link Setting} document.
   *
   * @example
   * ```http
   * PATCH /settings
   * Content-Type: multipart/form-data
   *
   * siteName={"en":"My Shop","ar":"متجري"}
   * logo=<binary>
   * vatRate=15
   * ```
   */
  @Patch()
  @RequirePermission(Permissions.UPDATE_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('settings')
  @UseInterceptors(
    FileFieldsInterceptor(SettingsController.imageSize),

    new ParseBodyJsonInterceptor([
      'metaTitle',
      'metaDescription',
      'siteName',
      'siteDescription',
      'footerText',
      'maintenanceMessage',
      'googleAnalyticsId',
      'googleReviews',
      'maintenanceMode',
      'socialLinks',
      'contactInfo',
      'businessAddress',
      'gateways',
      'bankTransferDetails',
      'features',
      'freeShippingThreshold',
      'vatRate',
      'minOrderAmount',
      'allowRegistration',
      'autoBackup',
      'taxesIncluded',
      'enablePerformance',
      'inventoryAlertsEnabled',
      'paymentsEnabled',
    ]),
  )
  async updateSettings(
    @UploadedFiles(
      new ParseFileFieldsPipe(
        '1MB',
        ['png', 'jpeg', 'webp', 'pdf'],
        [
          { name: 'favicon', required: false },
          { name: 'logo', required: false },
        ],
      ),
    )
    files: { favicon?: Express.Multer.File[]; logo?: Express.Multer.File[] },
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    return await this.settingsService.updateSettings(updateSettingDto, files);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /settings/clear-cache
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Manually flushes the server-side settings cache.
   *
   * **Access:** Admin only – requires the `UPDATE_SETTINGS` permission.
   *
   * Use this endpoint when the underlying settings document has been modified
   * externally (e.g. via a database migration or seed script) and the cached
   * version needs to be discarded immediately without performing a full update.
   *
   * **Side effects:**
   * - Deletes the `settings:global` cache entry.
   * - Triggers Next.js ISR revalidation for the `settings` and
   *   `public-settings` cache tags.
   *
   * @returns `{ success: true }` on successful cache invalidation.
   *
   * @example
   * ```http
   * PATCH /settings/clear-cache
   * Authorization: Bearer <admin-token>
   * ```
   */
  @Patch('clear-cache')
  @RequirePermission(Permissions.UPDATE_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async clearCache() {
    return await this.settingsService.clearCache();
  }
}
