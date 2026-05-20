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
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/',
      maxAge: 1 * 24 * 60 * 1000, // 1d
    });

    res.cookie('refresh_token', tokens.refresh_Token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/api/v1/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    res.cookie('is_logged_in', 'true', {
      httpOnly: false,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });
  }

  clearCookies(res: Response): void {
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/',
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/api/v1/auth/refresh-token',
    });

    res.clearCookie('is_logged_in', {
      httpOnly: false,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/',
    });

    //delete token from  header
    res.setHeader('Authorization', '');
  }
}
