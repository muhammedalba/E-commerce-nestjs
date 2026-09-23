import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Upper bound for the revalidation call so a slow/down frontend never stalls a write. */
const REVALIDATION_TIMEOUT_MS = 5000;

/**
 * Notifies the Next.js frontend (`POST /api/revalidate`) to expire ISR cache tags
 * after data changes, so storefront pages show fresh data on the next request.
 *
 * Best-effort: missing config, non-2xx responses and network errors are logged
 * and never propagated to the caller.
 */
@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * @param tags - Next.js cache tags to expire (e.g. `['products', 'product-my-slug']`).
   *               Must be allowed by the frontend's tag whitelist.
   */
  async revalidate(tags: string[]): Promise<void> {
    const uniqueTags = [...new Set(tags.filter(Boolean))];
    if (uniqueTags.length === 0) return;

    const frontendUrl = this.configService.get<string>('FRONTEND_ORIGIN');
    const secret = this.configService.get<string>('REVALIDATE_SECRET');

    if (!frontendUrl || !secret) {
      this.logger.warn(
        'Frontend URL or Revalidate Secret missing in config. Skipping revalidation.',
      );
      return;
    }

    const tagParam = uniqueTags.join(',');

    try {
      const response = await fetch(
        `${frontendUrl}/api/revalidate?tag=${encodeURIComponent(tagParam)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(REVALIDATION_TIMEOUT_MS),
        },
      );

      if (response.ok) {
        this.logger.log(
          `[ISR] Successfully triggered revalidation for tag: ${tagParam}`,
        );
      } else {
        const error = await response.text();
        this.logger.error(
          `[ISR] Failed to trigger revalidation for tag: ${tagParam}. Status: ${response.status} - ${error}`,
        );
      }
    } catch (err: unknown) {
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `[ISR] Network error while triggering revalidation for tag: ${tagParam}`,
        stack,
      );
    }
  }
}
