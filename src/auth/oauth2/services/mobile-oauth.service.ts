import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, createPublicKey, JsonWebKey } from 'crypto';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { GoogleService } from './google.service';
import { FacebookService } from './facebook.service';
import { AppleService } from './apple.service';

const GRAPH_URL = 'https://graph.facebook.com';
const FACEBOOK_TIMEOUT_MS = 5000;

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_TIMEOUT_MS = 5000;
// Apple rotates its signing keys rarely; refresh daily, and at most once a
// minute when a token names a key we don't have yet.
const APPLE_KEYS_TTL_MS = 24 * 60 * 60 * 1000;
const APPLE_KEYS_MIN_REFETCH_MS = 60 * 1000;

interface AppleIdTokenPayload {
  sub: string;
  email?: string;
  // Apple sends these as booleans or as the strings "true" / "false".
  email_verified?: boolean | string;
  nonce?: string;
}

interface FacebookDebugToken {
  data?: { is_valid?: boolean; app_id?: string };
}

interface FacebookProfile {
  id?: string;
  name?: string;
  email?: string;
  picture?: { data?: { url?: string } };
}

/**
 * Social login for native apps.
 *
 * @description The web flow redirects the browser through Google/Facebook and
 * back to the API (passport strategies). A native app instead signs in with the
 * provider's SDK on the device and sends the resulting token here; the token is
 * verified with the provider, then the same user lookup/provisioning as the web
 * flow runs ({@link GoogleService.issueTokens}, {@link FacebookService.issueTokens},
 * {@link AppleService.issueTokens}).
 *
 * @security A token is only accepted when it was issued for one of this app's
 * own client IDs; otherwise a token obtained by any other app using Google,
 * Facebook or Apple login could be replayed here to sign in as its user.
 */
@Injectable()
export class MobileOAuthService {
  private readonly logger = new Logger(MobileOAuthService.name);
  private readonly googleClient = new OAuth2Client();
  /** Apple's public signing keys (PEM) by key id. */
  private appleKeys = new Map<string, string>();
  private appleKeysFetchedAt = 0;

  constructor(
    private readonly googleService: GoogleService,
    private readonly facebookService: FacebookService,
    private readonly appleService: AppleService,
    private readonly jwtService: JwtService,
    private readonly i18n: CustomI18nService,
  ) {}

  /**
   * Verifies a Google ID token (signature, expiry, issuer, audience) and signs
   * the user in.
   *
   * @description Accepted audiences: `GOOGLE_CLIENT_ID` (the web client, which
   * Android uses as `serverClientId`) plus `GOOGLE_MOBILE_CLIENT_IDS`
   * (comma-separated iOS/Android client IDs).
   */
  async googleLogin(idToken: string) {
    const audience = [
      process.env.GOOGLE_CLIENT_ID,
      ...(process.env.GOOGLE_MOBILE_CLIENT_IDS ?? '').split(','),
    ]
      .map((id) => id?.trim())
      .filter((id): id is string => !!id);

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience,
      });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(`Google ID token rejected: ${String(err)}`);
      throw new UnauthorizedException(
        this.i18n.translate('exception.TOKEN_INVALID'),
      );
    }

    // Accounts are matched by email, so it must be one Google has verified.
    if (!payload?.email || !payload.email_verified) {
      throw new BadRequestException(
        this.i18n.translate('exception.OAUTH_EMAIL_REQUIRED'),
      );
    }

    return this.toResponse(
      await this.googleService.issueTokens({
        email: payload.email,
        name: payload.name || payload.email,
        picture: payload.picture ?? '',
      }),
    );
  }

  /**
   * Verifies a Facebook user access token was issued for this app, reads the
   * profile, and signs the user in.
   */
  async facebookLogin(accessToken: string) {
    const appId = process.env.FACEBOOK_CLIENT_ID ?? '';
    const appSecret = process.env.FACEBOOK_CLIENT_SECRET ?? '';

    // 1) The token must be valid and belong to this app
    const debug = await this.graphGet<FacebookDebugToken>('/debug_token', {
      input_token: accessToken,
      access_token: `${appId}|${appSecret}`,
    });
    if (!debug.data?.is_valid || debug.data.app_id !== appId) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.TOKEN_INVALID'),
      );
    }

    // 2) Read the profile (appsecret_proof proves the call comes from this server)
    const profile = await this.graphGet<FacebookProfile>('/me', {
      fields: 'id,name,email,picture.type(large)',
      access_token: accessToken,
      appsecret_proof: createHmac('sha256', appSecret)
        .update(accessToken)
        .digest('hex'),
    });
    // Facebook omits the email when the user denied the permission or has
    // none confirmed; accounts are matched by email, so it is required.
    if (!profile.email) {
      throw new BadRequestException(
        this.i18n.translate('exception.OAUTH_EMAIL_REQUIRED'),
      );
    }

    return this.toResponse(
      await this.facebookService.issueTokens({
        email: profile.email,
        name: profile.name || profile.email,
        picture: profile.picture?.data?.url ?? '',
      }),
    );
  }

  /**
   * Verifies a Sign in with Apple identity token and signs the user in.
   *
   * @description Checks the RS256 signature against Apple's published keys,
   * the issuer, the audience (`APPLE_BUNDLE_IDS`: the iOS app's bundle id),
   * the expiry, and that the token's `nonce` is the SHA-256 of the raw nonce
   * the app sent.
   *
   * @param identityToken - `identityToken` from the Apple SDK.
   * @param nonce - The raw nonce whose SHA-256 (hex) the app gave Apple.
   * @param fullName - The name Apple gave the app (first sign-in only).
   */
  async appleLogin(identityToken: string, nonce: string, fullName?: string) {
    const audience = (process.env.APPLE_BUNDLE_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (audience.length === 0) {
      this.logger.error('APPLE_BUNDLE_IDS is not set');
      throw new ServiceUnavailableException(
        this.i18n.translate('exception.OAUTH_PROVIDER_UNAVAILABLE'),
      );
    }

    const decoded = this.jwtService.decode<{
      header?: { kid?: string };
    } | null>(identityToken, { complete: true });
    const kid = decoded?.header?.kid;
    const publicKey = kid ? await this.getApplePublicKey(kid) : undefined;
    if (!publicKey) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.TOKEN_INVALID'),
      );
    }

    let payload: AppleIdTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AppleIdTokenPayload>(
        identityToken,
        {
          publicKey,
          algorithms: ['RS256'],
          issuer: APPLE_ISSUER,
          audience: audience as [string, ...string[]],
        },
      );
    } catch (err) {
      this.logger.warn(`Apple identity token rejected: ${String(err)}`);
      throw new UnauthorizedException(
        this.i18n.translate('exception.TOKEN_INVALID'),
      );
    }

    const expectedNonce = createHash('sha256').update(nonce).digest('hex');
    if (!payload.sub || payload.nonce !== expectedNonce) {
      this.logger.warn('Apple identity token rejected: nonce mismatch');
      throw new UnauthorizedException(
        this.i18n.translate('exception.TOKEN_INVALID'),
      );
    }

    return this.toResponse(
      await this.appleService.issueTokens({
        appleId: payload.sub,
        email: payload.email?.toLowerCase(),
        emailVerified:
          payload.email_verified === true || payload.email_verified === 'true',
        name: fullName,
      }),
    );
  }

  /** Apple's public key (PEM) for `kid`, refreshing the cached key set as needed. */
  private async getApplePublicKey(kid: string): Promise<string | undefined> {
    const age = Date.now() - this.appleKeysFetchedAt;
    const unknownKid = !this.appleKeys.has(kid);
    if (
      age > APPLE_KEYS_TTL_MS ||
      (unknownKid && age > APPLE_KEYS_MIN_REFETCH_MS)
    ) {
      try {
        await this.refreshAppleKeys();
      } catch (err) {
        this.logger.error(`Apple signing keys unavailable: ${String(err)}`);
        // A stale but known key still verifies; only fail without one.
        if (!this.appleKeys.has(kid)) {
          throw new ServiceUnavailableException(
            this.i18n.translate('exception.OAUTH_PROVIDER_UNAVAILABLE'),
          );
        }
      }
    }
    return this.appleKeys.get(kid);
  }

  private async refreshAppleKeys(): Promise<void> {
    const res = await fetch(APPLE_KEYS_URL, {
      signal: AbortSignal.timeout(APPLE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { keys } = (await res.json()) as {
      keys?: (JsonWebKey & { kid?: string })[];
    };
    const pems = new Map<string, string>();
    for (const jwk of keys ?? []) {
      if (!jwk.kid) continue;
      pems.set(
        jwk.kid,
        createPublicKey({ key: jwk, format: 'jwk' })
          .export({ type: 'spki', format: 'pem' })
          .toString(),
      );
    }
    if (pems.size === 0) throw new Error('no keys in response');
    this.appleKeys = pems;
    this.appleKeysFetchedAt = Date.now();
  }

  private toResponse(tokens: { refresh_Token: string; access_token: string }) {
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_Token,
    };
  }

  private async graphGet<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    let res: globalThis.Response;
    try {
      res = await fetch(`${GRAPH_URL}${path}?${new URLSearchParams(params)}`, {
        signal: AbortSignal.timeout(FACEBOOK_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.error(`Facebook Graph ${path} unreachable: ${String(err)}`);
      throw new ServiceUnavailableException(
        this.i18n.translate('exception.OAUTH_PROVIDER_UNAVAILABLE'),
      );
    }
    // 4xx: the user token is invalid/expired (Graph answers 400 for those)
    if (res.status >= 400 && res.status < 500) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.TOKEN_INVALID'),
      );
    }
    if (!res.ok) {
      this.logger.error(`Facebook Graph ${path} failed: HTTP ${res.status}`);
      throw new ServiceUnavailableException(
        this.i18n.translate('exception.OAUTH_PROVIDER_UNAVAILABLE'),
      );
    }
    return (await res.json()) as T;
  }
}
