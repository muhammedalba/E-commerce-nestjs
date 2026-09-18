import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { Setting, SettingDocument } from './shared/schema/setting.schema';
import { UpdateSettingDto } from './shared/dto/update-setting.dto';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { ExchangeRateSyncService } from './exchange-rate-sync.service';
import {
  FileAsset,
  StorageProviderType,
} from 'src/shared/schema/file-asset.schema';

/** Cache key used to store/retrieve the global settings object. */
const SETTINGS_CACHE_KEY = 'settings:global';

/** Mongoose document key that identifies the single global settings document. */
const SETTINGS_DOC_KEY = 'global';

/** Cache TTL for settings in milliseconds (1 hour). */
const SETTINGS_CACHE_TTL = 3600000;

/**
 * Service responsible for managing application-wide settings.
 *
 * Implements a **Cache-Aside** pattern:
 * - Reads are served from an in-memory cache (TTL = 1 h).
 * - Writes invalidate the cache and trigger Next.js ISR revalidation.
 *
 * The service stores a **single** MongoDB document keyed by `"global"` and
 * enriches it at read-time with runtime flags derived from other collections
 * (`hasCustomShippingRates`, `hasCustomTaxes`).
 *
 * @remarks
 * Exported by {@link SettingsModule} so that it can be consumed by
 * `CheckoutModule`, `OrderModule`, and any other feature that needs
 * access to global configuration values.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectModel(Setting.name)
    private readonly settingModel: Model<SettingDocument>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,

    private readonly configService: ConfigService,
    @Inject(forwardRef(() => FileUploadService))
    private readonly fileUploadService: FileUploadService,

    @InjectConnection()
    private readonly connection: Connection,

    @Inject(forwardRef(() => ExchangeRateSyncService))
    private readonly exchangeRateSyncService: ExchangeRateSyncService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves the global application settings.
   *
   * **Cache-Aside flow:**
   * 1. Return the cached value if it exists.
   * 2. Otherwise, upsert the settings document in MongoDB (creates a default
   *    document on first run if none exists).
   * 3. Enrich the result with two computed flags that reflect whether custom
   *    shipping rates or tax rules have been configured:
   *    - `hasCustomShippingRates` – `true` when at least one active `ShippingRate` doc exists.
   *    - `hasCustomTaxes` – `true` when at least one active `Tax` doc exists.
   * 4. Persist the enriched result to cache (TTL = {@link SETTINGS_CACHE_TTL}).
   *
   * @returns A plain {@link Setting} object (lean, not a Mongoose Document).
   *
   * @example
   * ```typescript
   * const settings = await this.settingsService.getSettings();
   * console.log(settings.siteName);
   * ```
   */
  async getSettings(): Promise<Setting> {
    // 1. Cache hit – fast path
    const cached = await this.cacheManager.get<Setting>(SETTINGS_CACHE_KEY);
    if (cached) return cached;

    // 2. Upsert the single global document (creates defaults on first run)
    const settings = await this.settingModel.findOneAndUpdate(
      { key: SETTINGS_DOC_KEY },
      { $setOnInsert: { key: SETTINGS_DOC_KEY } },
      // lean: true improves performance and reduces memory consumption
      { upsert: true, new: true, lean: true },
    );

    let hasCustomShippingRates = false;
    let hasCustomTaxes = false;

    // 3a. Computed flag: custom shipping rates
    try {
      if (this.connection.models['ShippingRate']) {
        const result = await this.connection.models['ShippingRate']
          .findOne({ isActive: true })
          .select('_id')
          .lean()
          .exec();
        hasCustomShippingRates = !!result;
      }
    } catch (e) {
      this.logger.error('Failed to check custom shipping rates', e);
    }

    // 3b. Computed flag: custom taxes
    try {
      if (this.connection.models['Tax']) {
        const result = await this.connection.models['Tax']
          .findOne({ isActive: true })
          .select('_id')
          .lean()
          .exec();
        hasCustomTaxes = !!result;
      }
    } catch (e) {
      this.logger.error('Failed to check custom taxes', e);
    }

    const settingsWithCustoms = {
      ...settings,
      hasCustomShippingRates,
      hasCustomTaxes,
    } as unknown as Setting;

    // 4. Populate cache for subsequent reads
    await this.cacheManager.set(
      SETTINGS_CACHE_KEY,
      settingsWithCustoms,
      SETTINGS_CACHE_TTL,
    );

    return settingsWithCustoms;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WRITE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Updates the global application settings and invalidates the cache.
   *
   * Image fields (`favicon`, `logo`) are handled with three distinct strategies
   * based on what is provided in the request:
   *
   * | Scenario | Result |
   * |---|---|
   * | New file uploaded | Old file deleted from disk, new path saved |
   * | DTO value is `"null"` or `null` | Old file deleted from disk, field set to `null` |
   * | No file and no explicit `null` | Field unchanged (excluded from `$set`) |
   *
   * Image uploads are processed **in parallel** via `Promise.all` to minimise
   * round-trip latency.
   *
   * After saving, the server-side cache is deleted and Next.js ISR revalidation
   * is triggered for the `settings` and `public-settings` cache tags.
   *
   * @param dto       - Validated payload containing the fields to update.
   * @param files     - Optional uploaded files keyed by field name.
   *                    Each field is an array produced by NestJS
   *                    `FileFieldsInterceptor`; only `[0]` is consumed.
   * @returns The updated settings document as a plain {@link Setting} object.
   *
   * @example
   * ```typescript
   * const updated = await this.settingsService.updateSettings(dto, files);
   * console.log(updated.logo); // '/uploads/Setting/logo-abc123.webp'
   * ```
   */
  async getStorageProvider(): Promise<StorageProviderType> {
    try {
      const settings = await this.getSettings();
      return settings.storageProvider || 'local';
    } catch {
      return 'local';
    }
  }

  async updateSettings(
    dto: UpdateSettingDto,
    files?: { favicon?: Express.Multer.File[]; logo?: Express.Multer.File[] },
  ): Promise<Setting> {
    if (dto.storageProvider === 'cloudinary') {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) {
        throw new BadRequestException(
          'Cannot switch to Cloudinary storage. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your server environment variables first.',
        );
      }
    }

    const currentSettings = await this.getSettings();
    const updateData: Record<string, unknown> = { ...dto };
    const imageFields = ['favicon', 'logo'] as const;

    // Process image uploads in parallel for better performance
    await Promise.all(
      imageFields.map(async (key) => {
        const fileArray = files?.[key];
        const file = fileArray?.[0];
        const dtoValue = dto[key];
        const oldAsset = currentSettings[key as keyof Setting] as
          | FileAsset
          | string
          | undefined;

        if (file) {
          // CASE A: New file uploaded – replace old file
          const newAsset = await this.fileUploadService.updateFile(
            file,
            Setting.name,
            oldAsset,
          );
          updateData[key] = newAsset;
        } else if (dtoValue === 'null' || dtoValue === null) {
          // CASE B: Explicit deletion – remove old file
          if (oldAsset) {
            await this.fileUploadService
              .deleteFile(oldAsset)
              .catch((err: unknown) => {
                const stack = err instanceof Error ? err.stack : undefined;
                this.logger.error(
                  `Failed to delete old ${key}: ${JSON.stringify(oldAsset)}`,
                  stack,
                );
              });
          }
          updateData[key] = null;
        } else {
          // CASE C: No change – exclude field from the update payload
          delete updateData[key];
        }
      }),
    );

    // Persist changes to the database
    const updatedDoc = await this.settingModel.findOneAndUpdate(
      { key: SETTINGS_DOC_KEY },
      { $set: updateData },
      { upsert: true, new: true, lean: true },
    );

    // Invalidate the server-side cache
    await this.cacheManager.del(SETTINGS_CACHE_KEY);

    // Notify the frontend to regenerate statically cached pages (ISR)
    await this.triggerRevalidation('settings,public-settings');

    // Re-sync the exchange rate immediately when the store switches currency,
    // instead of waiting for the next hourly cron run. This is awaited so the
    // response (and whatever refetches off it) already carries the freshly
    // synced rate — a fire-and-forget sync here would race the client's
    // post-save refetch and hand it back the stale rate.
    if (dto.currencyCode && dto.currencyCode !== currentSettings.currencyCode) {
      await this.exchangeRateSyncService.syncExchangeRate();
      return this.getSettings();
    }

    return updatedDoc as Setting;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER READS (consumed by other modules)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns the configured free-shipping order threshold.
   *
   * Delegates to {@link getSettings} so the result is served from cache.
   * Falls back to `0` when the field has not been set yet.
   *
   * @returns Minimum order total (in the store's base currency) required for
   *          free shipping, or `0` if not configured.
   *
   * @example
   * ```typescript
   * // In CheckoutService:
   * const threshold = await this.settingsService.getFreeShippingThreshold();
   * const isFree = cartTotal >= threshold;
   * ```
   */
  async getFreeShippingThreshold(): Promise<number> {
    const settings = await this.getSettings();
    return settings.freeShippingThreshold ?? 0;
  }

  /**
   * Checks whether the site is currently in maintenance mode.
   *
   * When `true`, the frontend should display a maintenance page and block
   * all non-admin operations.
   *
   * @returns `true` if maintenance mode is active, `false` otherwise.
   *
   * @example
   * ```typescript
   * if (await this.settingsService.isMaintenanceMode()) {
   *   throw new ServiceUnavailableException('Site is under maintenance');
   * }
   * ```
   */
  async isMaintenanceMode(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.maintenanceMode ?? false;
  }

  /**
   * Checks whether low-stock inventory alerts are enabled.
   *
   * Used by the cart and order flows to decide whether to emit inventory
   * warning notifications. Defaults to `true` if the flag has not been
   * explicitly configured.
   *
   * @returns `true` if inventory alerts are enabled (default), `false` if
   *          they have been disabled by an administrator.
   *
   * @example
   * ```typescript
   * if (await this.settingsService.isInventoryAlertsEnabled()) {
   *   await this.notificationService.sendLowStockAlert(productId);
   * }
   * ```
   */
  async isInventoryAlertsEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.inventoryAlertsEnabled ?? true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CACHE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Manually flushes the settings cache and triggers ISR revalidation.
   *
   * Useful when an external process modifies the underlying settings document
   * directly (e.g. a database migration or seed script) and the cache needs to
   * be invalidated without going through {@link updateSettings}.
   *
   * @returns An object `{ success: true }` upon successful cache invalidation.
   *
   * @example
   * ```typescript
   * // Via HTTP: PATCH /settings/clear-cache
   * await this.settingsService.clearCache();
   * ```
   */
  async clearCache(): Promise<{ success: boolean }> {
    await this.cacheManager.del(SETTINGS_CACHE_KEY);
    await this.triggerRevalidation('settings,public-settings');
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sends an HTTP POST request to the Next.js ISR revalidation endpoint.
   *
   * This allows the frontend to immediately regenerate any statically cached
   * pages that depend on the provided cache `tag` without waiting for the
   * next scheduled revalidation cycle.
   *
   * The method is a **best-effort** operation: if the frontend URL or the
   * shared secret are not configured, revalidation is silently skipped.
   * Network errors are caught and logged without propagating to the caller.
   *
   * @param tag - Comma-separated Next.js cache tags to revalidate
   *              (e.g. `"settings,public-settings"`).
   * @returns `void` – callers should not depend on the outcome.
   *
   * @internal
   */
  private async triggerRevalidation(tag: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_ORIGIN');
    const secret = this.configService.get<string>('REVALIDATE_SECRET');

    if (!frontendUrl || !secret) {
      this.logger.warn(
        'Frontend URL or Revalidate Secret missing in config. Skipping revalidation.',
      );
      return;
    }

    try {
      const response = await fetch(`${frontendUrl}/api/revalidate?tag=${tag}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        this.logger.log(
          `[ISR] Successfully triggered revalidation for tag: ${tag}`,
        );
      } else {
        const error = await response.text();
        this.logger.error(
          `[ISR] Failed to trigger revalidation for tag: ${tag}. Status: ${response.status} - ${error}`,
        );
      }
    } catch (err: unknown) {
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `[ISR] Network error while triggering revalidation for tag: ${tag}`,
        stack,
      );
    }
  }
}
