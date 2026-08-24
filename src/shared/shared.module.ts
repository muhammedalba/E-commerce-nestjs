import { Global, Module } from '@nestjs/common';
import { CustomI18nService } from './utils/i18n/custom-i18n.service';

/**
 * Global shared module that provides cross-cutting utilities
 * available to all modules without explicit imports.
 *
 * Currently exports:
 * - CustomI18nService: i18n translation and response localization utility
 */
@Global()
@Module({
  providers: [CustomI18nService],
  exports: [CustomI18nService],
})
export class SharedModule {}
