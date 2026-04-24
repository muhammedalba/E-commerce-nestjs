import { SetMetadata } from '@nestjs/common';

export const CLEAR_CACHE_RESOURCES = 'clear_cache_resources';

/**
 * Decorator to specify which cache resources to clear after a successful request.
 * Example: @ClearCache('products', 'categories')
 */
export const ClearCache = (...resources: string[]) =>
  SetMetadata(CLEAR_CACHE_RESOURCES, resources);
