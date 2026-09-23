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
import { Setting, SettingDocument } from './shared/schema/setting.schema';
import { UpdateSettingDto } from './shared/dto/update-setting.dto';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { ExchangeRateSyncService } from './exchange-rate-sync.service';
import {
  FileAsset,
  StorageProviderType,
} from 'src/shared/schema/file-asset.schema';
import { RevalidationService } from 'src/shared/services/revalidation.service';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import {
  decryptConfigValues,
  encryptConfigValues,
} from 'src/payments/shared/utils/encryption.util';
import {
  PLACE_ID_PATTERN,
  isExpandedGoogleMapsUrl,
  isGoogleHost,
  parseGoogleMapsUrl,
} from './shared/utils/google-maps-url.util';

/** Cache key used to store/retrieve the global settings object. */
const SETTINGS_CACHE_KEY = 'settings:global';

/** Cache key prefix for Google reviews (one entry per language). */
const GOOGLE_REVIEWS_CACHE_PREFIX = 'google-reviews:';

/** Supported review languages. */
const GOOGLE_REVIEWS_LANGS = ['ar', 'en'] as const;
export type GoogleReviewsLang = (typeof GOOGLE_REVIEWS_LANGS)[number];

/** Successful Google reviews are cached for 24 h to minimise Places API cost. */
const GOOGLE_REVIEWS_CACHE_TTL = 24 * 60 * 60 * 1000;

/** Failed lookups are cached briefly so a bad key/Place ID doesn't hammer the API. */
const GOOGLE_REVIEWS_ERROR_TTL = 10 * 60 * 1000;

const GOOGLE_PLACES_TIMEOUT_MS = 5000;

interface GooglePlaceReview {
  rating?: number;
  relativePublishTimeDescription?: string;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
}

interface GooglePlaceResponse {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: GooglePlaceReview[];
}

/** Slim, public-safe payload returned by `GET /settings/google-reviews`. */
export interface GoogleReviewsResult {
  enabled: boolean;
  rating: number;
  total: number;
  url: string;
  reviews: {
    author: string;
    authorUrl: string;
    photo: string;
    rating: number;
    text: string;
    time: string;
  }[];
}

const EMPTY_GOOGLE_REVIEWS: GoogleReviewsResult = {
  enabled: false,
  rating: 0,
  total: 0,
  url: '',
  reviews: [],
};

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

    private readonly revalidationService: RevalidationService,
    @Inject(forwardRef(() => FileUploadService))
    private readonly fileUploadService: FileUploadService,

    @InjectConnection()
    private readonly connection: Connection,

    @Inject(forwardRef(() => ExchangeRateSyncService))
    private readonly exchangeRateSyncService: ExchangeRateSyncService,

    private readonly httpService: HttpService,
  ) {}

  /**
   * Strips the encrypted Google Places API key from a settings object and
   * replaces it with a boolean flag, so the secret never reaches the public
   * `GET /settings` response or the settings cache.
   */
  private toPublicSettings<T extends { googlePlacesApiKey?: string }>(
    settings: T,
  ): Omit<T, 'googlePlacesApiKey'> & { hasGooglePlacesApiKey: boolean } {
    const { googlePlacesApiKey, ...rest } = settings;
    return { ...rest, hasGooglePlacesApiKey: !!googlePlacesApiKey };
  }

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
      ...(settings ? this.toPublicSettings(settings) : {}),
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

    // Google Places API key: encrypt when a new value is provided (same
    // AES-256-GCM scheme as payment secrets); otherwise keep the stored key.
    const newPlacesKey = dto.googlePlacesApiKey?.trim();
    if (newPlacesKey) {
      const encrypted = encryptConfigValues({
        googlePlacesApiKey: newPlacesKey,
      }) as { googlePlacesApiKey: string };
      updateData.googlePlacesApiKey = encrypted.googlePlacesApiKey;
    } else {
      delete updateData.googlePlacesApiKey;
    }

    // Auto-detect the Google Place ID from the pasted Google Maps link
    if (dto.googleReviews) {
      updateData.googleReviews = await this.resolveGoogleReviewsPlaceId(
        dto.googleReviews,
        currentSettings.googleReviews,
        newPlacesKey,
      );
    }

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

    // Invalidate the server-side cache (settings + Google reviews)
    await Promise.all([
      this.cacheManager.del(SETTINGS_CACHE_KEY),
      ...this.googleReviewsCacheKeys().map((key) => this.cacheManager.del(key)),
    ]);

    // Notify the frontend to regenerate statically cached pages (ISR)
    await this.revalidationService.revalidate(['settings', 'public-settings']);

    // Re-sync the exchange rate immediately when the store switches currency,
    // instead of waiting for the next hourly cron run. This is awaited so the
    // response (and whatever refetches off it) already carries the freshly
    // synced rate — a fire-and-forget sync here would race the client's
    // post-save refetch and hand it back the stale rate.
    if (dto.currencyCode && dto.currencyCode !== currentSettings.currencyCode) {
      await this.exchangeRateSyncService.syncExchangeRate();
      return this.getSettings();
    }

    return (updatedDoc
      ? this.toPublicSettings(updatedDoc)
      : updatedDoc) as unknown as Setting;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GOOGLE REVIEWS
  // ─────────────────────────────────────────────────────────────────────────────

  private googleReviewsCacheKeys(): string[] {
    return GOOGLE_REVIEWS_LANGS.map(
      (lang) => `${GOOGLE_REVIEWS_CACHE_PREFIX}${lang}`,
    );
  }

  /** Reads and decrypts the stored Google Places API key (server-side only). */
  private async getStoredPlacesApiKey(): Promise<string> {
    const keyDoc = await this.settingModel
      .findOne({ key: SETTINGS_DOC_KEY })
      .select('googlePlacesApiKey')
      .lean();
    const { googlePlacesApiKey } = decryptConfigValues({
      googlePlacesApiKey: keyDoc?.googlePlacesApiKey ?? '',
    }) as { googlePlacesApiKey: string };
    return googlePlacesApiKey;
  }

  /**
   * Fills `placeId` from `reviewsUrl` when the admin pasted a Google Maps link
   * without a Place ID, or changed the link while leaving the old Place ID.
   *
   * Resolution order:
   * 1. The link already contains a Place ID (`placeid=`, `q=place_id:` …).
   * 2. Otherwise the business name + pin coordinates are read from the link
   *    and looked up once via Places Text Search (IDs-only field mask).
   *
   * Throws a `BadRequestException` only when reviews are enabled, so the admin
   * knows immediately that the link couldn't be resolved.
   */
  private async resolveGoogleReviewsPlaceId(
    next: NonNullable<UpdateSettingDto['googleReviews']>,
    current: Setting['googleReviews'] | undefined,
    newApiKey?: string,
  ): Promise<NonNullable<UpdateSettingDto['googleReviews']>> {
    const reviewsUrl = next.reviewsUrl?.trim() ?? '';
    const placeId = next.placeId?.trim() ?? '';
    const urlChanged = reviewsUrl !== (current?.reviewsUrl ?? '');
    const needsResolve =
      !!reviewsUrl &&
      (!placeId || (urlChanged && placeId === (current?.placeId ?? '')));

    if (!needsResolve) return { ...next, reviewsUrl, placeId };

    const fail = (reason: string) => {
      if (next.enabled) {
        throw new BadRequestException(
          `Could not detect the Google Place ID from the link (${reason}). Please enter the Place ID manually.`,
        );
      }
      this.logger.warn(`Google Place ID auto-detection skipped: ${reason}`);
      return { ...next, reviewsUrl, placeId };
    };

    try {
      const expandedUrl = await this.expandGoogleMapsUrl(reviewsUrl);
      const parsed = parseGoogleMapsUrl(expandedUrl);
      if (parsed.placeId) {
        return { ...next, reviewsUrl, placeId: parsed.placeId };
      }
      if (!parsed.name) return fail('no business name found in the link');

      const apiKey = newApiKey || (await this.getStoredPlacesApiKey());
      if (!apiKey) return fail('Google Places API key is missing');

      const hasCoords = parsed.lat !== undefined && parsed.lng !== undefined;
      const { data } = await lastValueFrom(
        this.httpService.post<{ places?: { id?: string }[] }>(
          'https://places.googleapis.com/v1/places:searchText',
          {
            textQuery: parsed.name,
            pageSize: 1,
            ...(hasCoords && {
              locationBias: {
                circle: {
                  center: { latitude: parsed.lat, longitude: parsed.lng },
                  radius: 500,
                },
              },
            }),
          },
          {
            headers: {
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.id',
            },
            timeout: GOOGLE_PLACES_TIMEOUT_MS,
          },
        ),
      );

      const resolvedId = data.places?.[0]?.id;
      if (!resolvedId || !PLACE_ID_PATTERN.test(resolvedId)) {
        return fail('no matching place found on Google');
      }

      this.logger.log(`Google Place ID auto-detected: ${resolvedId}`);
      return { ...next, reviewsUrl, placeId: resolvedId };
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      const error = err as Error & {
        response?: { data?: { error?: { message?: string } } };
      };
      return fail(error.response?.data?.error?.message || error.message);
    }
  }

  /**
   * Follows short links (`maps.app.goo.gl`, `g.page`, …) until a full Google
   * Maps URL is reached. Every hop is validated against {@link isGoogleHost}
   * *before* it is requested, so only Google hosts are ever contacted.
   */
  private async expandGoogleMapsUrl(raw: string): Promise<string> {
    let current = raw;

    for (let hop = 0; hop < 5; hop++) {
      const url = new URL(current);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        !isGoogleHost(url.hostname)
      ) {
        throw new BadRequestException('Only Google Maps links are supported');
      }

      // EU cookie-consent interstitial: the real target is in `continue`
      const consentTarget =
        url.hostname.startsWith('consent.') && url.searchParams.get('continue');
      if (consentTarget) {
        current = consentTarget;
        continue;
      }

      if (isExpandedGoogleMapsUrl(current)) return current;

      const response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(GOOGLE_PLACES_TIMEOUT_MS),
      });
      await response.body?.cancel().catch(() => undefined);

      const location = response.headers.get('location');
      if (response.status < 300 || response.status >= 400 || !location) {
        return current;
      }
      current = new URL(location, current).toString();
    }

    return current;
  }

  /**
   * Returns the store's Google reviews using the Google Places API (New).
   *
   * - Returns `{ enabled: false }` when the admin disabled the feature or the
   *   Place ID / API key are missing.
   * - The API key is stored encrypted and only decrypted here, server-side.
   * - Results are cached per language for {@link GOOGLE_REVIEWS_CACHE_TTL};
   *   failures are cached for {@link GOOGLE_REVIEWS_ERROR_TTL}.
   *
   * @param lang - Review language (`ar` | `en`).
   */
  async getGoogleReviews(
    lang: GoogleReviewsLang,
  ): Promise<GoogleReviewsResult> {
    const cacheKey = `${GOOGLE_REVIEWS_CACHE_PREFIX}${lang}`;
    const cached = await this.cacheManager.get<GoogleReviewsResult>(cacheKey);
    if (cached) return cached;

    const settings = await this.getSettings();
    const config = settings.googleReviews;
    if (
      !config?.enabled ||
      !config.placeId ||
      !settings.hasGooglePlacesApiKey
    ) {
      this.logger.debug(
        `Google reviews skipped: enabled=${!!config?.enabled}, placeId=${!!config?.placeId}, apiKey=${!!settings.hasGooglePlacesApiKey}`,
      );
      return EMPTY_GOOGLE_REVIEWS;
    }

    const apiKey = await this.getStoredPlacesApiKey();
    if (!apiKey) return EMPTY_GOOGLE_REVIEWS;

    try {
      const { data } = await lastValueFrom(
        this.httpService.get<GooglePlaceResponse>(
          `https://places.googleapis.com/v1/places/${encodeURIComponent(config.placeId)}`,
          {
            params: { languageCode: lang },
            headers: {
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask':
                'rating,userRatingCount,googleMapsUri,reviews',
            },
            timeout: GOOGLE_PLACES_TIMEOUT_MS,
          },
        ),
      );

      const result: GoogleReviewsResult = {
        enabled: true,
        rating: data.rating ?? 0,
        total: data.userRatingCount ?? 0,
        url: config.reviewsUrl || data.googleMapsUri || '',
        reviews: (data.reviews ?? [])
          .map((review) => ({
            author: review.authorAttribution?.displayName ?? '',
            authorUrl: review.authorAttribution?.uri ?? '',
            photo: review.authorAttribution?.photoUri ?? '',
            rating: review.rating ?? 5,
            text: review.text?.text || review.originalText?.text || '',
            time: review.relativePublishTimeDescription ?? '',
          }))
          .filter((review) => review.text.trim() !== ''),
      };

      await this.cacheManager.set(cacheKey, result, GOOGLE_REVIEWS_CACHE_TTL);
      return result;
    } catch (err: unknown) {
      // Surface Google's own error (e.g. API not enabled, key restricted)
      const error = err as Error & {
        response?: { data?: { error?: { status?: string; message?: string } } };
      };
      const googleError = error.response?.data?.error;
      this.logger.warn(
        `Failed to fetch Google reviews: ${error.message}` +
          (googleError
            ? ` — ${googleError.status}: ${googleError.message}`
            : ''),
      );
      await this.cacheManager.set(
        cacheKey,
        EMPTY_GOOGLE_REVIEWS,
        GOOGLE_REVIEWS_ERROR_TTL,
      );
      return EMPTY_GOOGLE_REVIEWS;
    }
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
    await Promise.all([
      this.cacheManager.del(SETTINGS_CACHE_KEY),
      ...this.googleReviewsCacheKeys().map((key) => this.cacheManager.del(key)),
    ]);
    await this.revalidationService.revalidate(['settings', 'public-settings']);
    return { success: true };
  }
}
