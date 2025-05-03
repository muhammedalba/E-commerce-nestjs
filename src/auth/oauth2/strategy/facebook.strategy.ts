// auth/strategies/facebook.strategy.ts

import { BadRequestException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  Profile,
  StrategyOptionsWithRequest,
} from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor() {
    super({
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/api/v1/auth/facebook/redirect`,
      scope: ['email', 'public_profile'], //
      profileFields: ['id', 'name', 'email', 'picture.type(large)'], //
      passReqToCallback: true,
    } as StrategyOptionsWithRequest);
  }

  validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ) {
    const { name, photos, emails } = profile;
    const userData = {
      email: emails?.[0]?.value,
      name: `${name?.givenName} ${name?.familyName}`,
      facebookId: profile.id,
      picture: photos?.[0]?.value,
      provider: 'facebook',
    };
    if (!userData.email) {
      throw new BadRequestException('email not found');
    }

    return userData;
  }
}
