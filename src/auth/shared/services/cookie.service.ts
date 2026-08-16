import { Injectable } from '@nestjs/common';
import { Response } from 'express';

/**
 * Centralizes authentication cookie configuration.
 *
 * @description All services that issue or clear auth state should use this service
 * so cookie names, paths, SameSite policy, production domain, and max-age values
 * remain consistent across login, registration, OAuth, refresh, and logout flows.
 *
 * @security The access and refresh tokens are stored in `httpOnly` cookies. The
 * `is_logged_in` cookie is deliberately readable by JavaScript and must only be
 * treated as a UI hint, never as proof of authentication.
 */
@Injectable()
export class CookieService {
  private readonly isProd = process.env.NODE_ENV === 'production';

  /**
   * Writes the access token, refresh token, and UI login-state cookie.
   *
   * @description Also mirrors the access token into the `Authorization` response
   * header for clients that read tokens from headers immediately after login.
   *
   * @security
   * - `access_token`: `httpOnly`, path `/`, SameSite `lax`.
   * - `refresh_token`: `httpOnly`, path limited to `/api/v1/auth/refresh-token`,
   *   SameSite `strict` to reduce cross-site refresh attempts.
   * - Production cookies use the shared `.skygalaxy.shop` domain.
   *
   * @param res - Express response used to write cookies and headers.
   * @param tokens - Freshly generated access and refresh tokens.
   */
  setCookies(
    res: Response,
    tokens: {
      refresh_Token: string;
      access_token: string;
    },
  ): void {
    res.setHeader('Authorization', `Bearer ${tokens.access_token}`);

    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: this.isProd,
      // 'lax' is safe here because:
      // 1) CORS is restricted to an allowlist (no wildcard origin) in main.ts
      // 2) OAuth redirects (Google/Facebook) are GET requests, which 'lax' allows
      // 3) Frontend and backend share the .skygalaxy.shop domain
      // 'none' is NOT required and was unnecessarily broadening CSRF attack surface
      sameSite: 'lax',
      ...(this.isProd && { domain: '.skygalaxy.shop' }),
      path: '/',
      maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
    });

    res.cookie('refresh_token', tokens.refresh_Token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'strict',
      ...(this.isProd && { domain: '.skygalaxy.shop' }),
      path: '/api/v1/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    res.cookie('is_logged_in', 'true', {
      httpOnly: false,
      secure: this.isProd,
      sameSite: 'lax',
      ...(this.isProd && { domain: '.skygalaxy.shop' }),
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });
  }

  /**
   * Clears all authentication cookies using matching cookie attributes.
   *
   * @description Cookie deletion must use the same path/domain/SameSite settings
   * used when setting the cookies; otherwise browsers can keep stale auth cookies.
   * This method also clears the response `Authorization` header.
   *
   * @param res - Express response used to clear cookies and headers.
   */
  clearCookies(res: Response): void {
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      ...(this.isProd && { domain: '.skygalaxy.shop' }),
      path: '/',
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'strict',
      ...(this.isProd && { domain: '.skygalaxy.shop' }),
      path: '/api/v1/auth/refresh-token',
    });

    res.clearCookie('is_logged_in', {
      httpOnly: false,
      secure: this.isProd,
      sameSite: 'lax',
      ...(this.isProd && { domain: '.skygalaxy.shop' }),
      path: '/',
    });

    //delete token from  header
    res.setHeader('Authorization', '');
  }
}
