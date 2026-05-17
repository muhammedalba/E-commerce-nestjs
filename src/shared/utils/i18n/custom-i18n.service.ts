import { Injectable } from '@nestjs/common';
import { I18nContext, I18nService, TranslateOptions } from 'nestjs-i18n';
import { Types } from 'mongoose';
import { withBaseUrl } from 'src/shared/utils/with-base-url.util';

/**
 * Custom Service for Internationalization (i18n) and Data Localization.
 * Provides automated translation and dynamic media URL formatting for API responses.
 */
@Injectable()
export class CustomI18nService {
  constructor(private readonly i18n: I18nService) {}

  /**
   * Set of field names recognized as media or file paths.
   * These fields will automatically have the BASE_URL prepended during localization.
   */
  private readonly fileFields = new Set([
    'avatar',
    'image',
    'imageCover',
    'infoProductPdf',
    'images',
    'carouselSm',
    'carouselMd',
    'carouselLg',
    'carouselImage',
    'logo',
    'favicon',
    'transferReceiptImg',
    'InvoicePdf',
  ]);

  /**
   * Translates a specific key based on the current request language.
   *
   * @param key - Translation key (e.g., 'common.save')
   * @param options - Additional translation options like variables
   * @returns The translated string in the current locale
   */
  translate(key: string, options?: TranslateOptions): string {
    const lang = this.getLang();
    return this.i18n.translate(key, {
      lang,
      ...options,
    });
  }

  /**
   * Retrieves the current language code for the request.
   * Checks i18n context, then environment variables, falling back to 'ar'.
   *
   * @returns Language code (e.g., 'ar', 'en')
   */
  getLang(): string {
    return I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
  }

  /**
   * Comprehensive function to localize objects and arrays.
   * Recursively traverses data to apply translations and format media URLs.
   *
   * @param data - The raw data to process (Object or Array)
   * @param allLangs - If true, returns the full translation object instead of localized string
   * @returns The localized and formatted data
   */
  localize(data: any, allLangs: boolean = false) {
    if (!data) return data;
    const lang = this.getLang();

    /**
     * Internal recursive processor for nested items
     */
    const processItem = (obj: any): any => {
      // 1. Return if not an object or null
      if (!obj || typeof obj !== 'object') return obj;

      // 2. Handle MongoDB specific types
      if (obj instanceof Types.ObjectId) return obj.toString();
      if (obj instanceof Date) return obj;

      // 3. Process Arrays
      if (Array.isArray(obj)) {
        return obj.map((item) => processItem(item));
      }

      // 4. Convert Mongoose Documents to plain objects
      const raw = obj.toObject ? obj.toObject() : { ...obj };

      // 5. Dynamically iterate over object keys
      for (const key in raw) {
        let value = raw[key];

        // A) Process Media/File fields
        if (this.fileFields.has(key) && value) {
          if (Array.isArray(value)) {
            raw[key] = withBaseUrl(value);
          } else {
            raw[key] = withBaseUrl(value);
          }
          continue;
        }

        // B) Process Translatable strings (if ar/en keys exist)
        if (
          !allLangs &&
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          (value['ar'] !== undefined || value['en'] !== undefined)
        ) {
          raw[key] = value[lang] || value['en'] || value['ar'] || value;
          continue;
        }

        // C) Recursively process nested objects/relationships
        if (typeof value === 'object' && value !== null) {
          raw[key] = processItem(value);
        }
      }

      return raw;
    };

    return Array.isArray(data)
      ? data.map((item) => processItem(item))
      : processItem(data);
  }
}
