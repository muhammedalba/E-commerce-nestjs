import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Response } from 'express';
import { TokenService } from 'src/auth/shared/services/token.service';
import { CookieService } from 'src/auth/shared/services/cookie.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { User } from 'src/auth/shared/schema/user.schema';
import { Role } from 'src/roles/shared/schemas/role.schema';
import { FacebookOAuthUser } from 'src/auth/shared/types/oauth-user.interface';

@Injectable()
export class FacebookService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Role.name) private roleModel: Model<Role>,
    private readonly i18n: CustomI18nService,
    private readonly tokenService: TokenService,
    private readonly cookieService: CookieService,
  ) {}

  async facebookLogin(facebookUser: FacebookOAuthUser, res: Response) {
    const { email, name, picture } = facebookUser;

    // 1) check user is use
    const user = await this.userModel
      .findOne({ email: email })
      .select('name role email avatar isActive')
      .populate('role')
      .lean();

    let Tokens: { refresh_Token: string; access_token: string };
    //
    if (!user) {
      //1) create password
      const randomPassword = crypto.randomBytes(16).toString('hex');

      // 2) Fetch the default 'User' role
      const userRole = await this.roleModel.findOne({ name: 'User' });

      // 3) create user
      const newUser = await this.userModel.create({
        email: email,
        name: name,
        password: randomPassword,
        avatar: picture,
        provider: 'facebook',
        role: userRole ? userRole._id : undefined,
        lastLogin: new Date(),
      });
      const userId = {
        user_id: newUser._id.toString(),
        role: 'User',
        level: userRole ? userRole.level : 1,
        email: newUser.email,
      };
      // 3) generate access token
      Tokens = await this.tokenService.generate_Tokens(userId, '1h');
      //4) send token to cookies

      this.cookieService.setCookies(
        res,
        Tokens,
        // 'user',
        // newUser.name,
        // newUser.avatar,
      );

      return {
        status: 'success',
        message: this.i18n.translate('success.LOGIN_SUCCESS'),
        data: { ...newUser.toObject(), password: undefined },
        access_token: Tokens.access_token,
      };
    } else {
      if (!user.isActive) {
        throw new BadRequestException(
          this.i18n.translate('exception.ACCOUNT_BLOCKED'),
        );
      }
      const userId = {
        user_id: user._id.toString(),
        role: user.role?.name || 'user',
        level: user.role?.level || 0,
        email: user.email,
      };
      Tokens = await this.tokenService.generate_Tokens(userId);
      await this.userModel.findByIdAndUpdate(user._id, {
        $set: { lastLogin: new Date() },
      });
      this.cookieService.setCookies(
        res,
        Tokens,
        // user.role || 'user',
        // user.name,
        // user.avatar,
      );
    }

    return {
      status: 'success',
      message: this.i18n.translate('success.LOGIN_SUCCESS'),
      data: user,
      access_token: Tokens.access_token,
    };
  }
}
