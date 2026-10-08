import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { GoogleService } from './google.service';
import { FacebookService } from './facebook.service';

const GRAPH_URL = 'https://graph.facebook.com';
const FACEBOOK_TIMEOUT_MS = 5000;

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
 * flow runs ({@link GoogleService.issueTokens}, {@link FacebookService.issueTokens}).
 *
 * @security A token is only accepted when it was issued for one of this app's
 * own client IDs; otherwise a token obtained by any other app using Google or
 * Facebook login could be replayed here to sign in as its user.
 */
@Injectable()
export class MobileOAuthService {
  private readonly logger = new Logger(MobileOAuthService.name);
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly googleService: GoogleService,
    private readonly facebookService: FacebookService,
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
