import { SetMetadata } from '@nestjs/common';

export const ALLOW_ANY_CLIENT_KEY = 'allowAnyClient';

/**
 * Exempts a route (or controller) from ClientAccessGuard, for callers that
 * are neither the website nor the mobile app: payment webhooks, OAuth
 * callbacks, health checks, token-protected download links.
 */
export const AllowAnyClient = () => SetMetadata(ALLOW_ANY_CLIENT_KEY, true);
