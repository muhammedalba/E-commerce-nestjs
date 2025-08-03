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
    // role?: string,
    // name?: string,
    // avatar?: string,
  ): void {
    res.setHeader('Authorization', `Bearer ${tokens.access_token}`);
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refresh_token', tokens.refresh_Token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/api/v1/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    // if (avatar && name && role) {
    //   res.cookie('avatar', avatar, {
    //     httpOnly: false,
    //     secure: process.env.NODE_ENV === 'production',
    //     sameSite: this.isProd ? 'none' : 'lax',
    //     path: '/',
    //     maxAge: 7 * 24 * 60 * 60 * 1000,
    //   });
    //   res.cookie('role', role, {
    //     httpOnly: false,
    //     secure: process.env.NODE_ENV === 'production',
    //     sameSite: this.isProd ? 'none' : 'lax',
    //     path: '/',
    //     maxAge: 7 * 24 * 60 * 60 * 1000,
    //   });

    //   res.cookie('name', name, {
    //     httpOnly: false,
    //     secure: process.env.NODE_ENV === 'production',
    //     sameSite: this.isProd ? 'none' : 'lax',
    //     path: '/',
    //     maxAge: 7 * 24 * 60 * 60 * 1000,
    //   });
    // }
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

    res.clearCookie('role', {
      httpOnly: false,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/',
    });

    res.clearCookie('name', {
      httpOnly: false,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/',
    });

    res.clearCookie('avatar', {
      httpOnly: false,
      secure: this.isProd,
      sameSite: this.isProd ? 'none' : 'lax',
      path: '/',
    });
    //delete token from  header
    res.setHeader('Authorization', '');
  }
}
