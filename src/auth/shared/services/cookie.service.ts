import { Injectable } from '@nestjs/common';
import { Response } from 'express';

@Injectable()
export class CookieService {
  private readonly isProd = process.env.NODE_ENV === 'production';

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
