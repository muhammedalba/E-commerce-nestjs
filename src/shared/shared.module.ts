import { Global, Module } from '@nestjs/common';
import { CustomI18nService } from './utils/i18n/custom-i18n.service';
import { RevalidationService } from './services/revalidation.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';

/**
 * Global shared module that provides cross-cutting utilities
 * available to all modules without explicit imports.
 *
 * Currently exports:
 * - CustomI18nService: i18n translation and response localization utility
 * - RevalidationService: Next.js ISR cache-tag revalidation
 * - CacheInvalidationService: backend response-cache clearing per resource
 */
@Global()
@Module({
  providers: [CustomI18nService, RevalidationService, CacheInvalidationService],
  exports: [CustomI18nService, RevalidationService, CacheInvalidationService],
})
export class SharedModule {}
