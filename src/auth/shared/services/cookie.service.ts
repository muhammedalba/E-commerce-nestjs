import { Injectable } from '@nestjs/common';
import { Response } from 'express';

@Injectable()
export class CookieService {
  setCookies(
    res: Response,
    tokens: {
      refresh_Token: string;
      access_token: string;
    },
    role?: string,
    name?: string,
    avatar?: string,
  ): void {
    res.setHeader('Authorization', `Bearer ${tokens.access_token}`);

    res.cookie('access_token', tokens.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/api/v1/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    res.cookie('refresh_token', tokens.refresh_Token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/api/v1/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    if (avatar && name && role) {
      res.cookie('avatar', avatar, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.cookie('role', role, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.cookie('name', name, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
  }

  clearCookies(res: Response): void {
    const isProd = process.env.NODE_ENV === 'production';

    // 🧼 حذف كوكيز محمية
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/api/v1/auth/refresh-token',
    });

    // 🧼 حذف كوكيز قابلة للقراءة من العميل
    res.clearCookie('role', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
    });

    res.clearCookie('name', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
    });

    res.clearCookie('avatar', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
    });

    // حذف الهيدر أيضاً
    res.setHeader('Authorization', '');
  }
}
