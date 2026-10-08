import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { TokenService } from 'src/auth/shared/services/token.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { User } from 'src/auth/shared/schema/user.schema';
import { Role } from 'src/roles/shared/schemas/role.schema';
import { oauthDisplayName } from '../utils/display-name.util';

/** A verified Sign in with Apple identity. */
export interface AppleProfile {
  /** Apple's stable user id (`sub`). */
  appleId: string;
  /** Real or private relay email; Apple may omit it. */
  email?: string;
  emailVerified: boolean;
  /** Sent by the app on the first sign-in only. */
  name?: string;
}

/**
 * Finds or provisions the user for a verified Apple identity and issues a
 * token pair.
 *
 * @description Unlike Google/Facebook, the email cannot be the only key:
 * with "Hide My Email" Apple hands out a private relay address, so a user who
 * signed up on the web with a real email would not be found by it. Lookup:
 * 1. by `appleId` (every sign-in after the first);
 * 2. by verified email, linking the Apple id to that existing account;
 * 3. otherwise a new account with provider 'apple'.
 */
@Injectable()
export class AppleService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Role.name) private roleModel: Model<Role>,
    private readonly i18n: CustomI18nService,
    private readonly tokenService: TokenService,
  ) {}

  async issueTokens(
    profile: AppleProfile,
  ): Promise<{ refresh_Token: string; access_token: string }> {
    const { appleId, email, emailVerified } = profile;

    // 1) Returning Apple user
    let user = await this.userModel
      .findOne({ appleId })
      .select('role email isActive')
      .populate<{ role: Role | null }>('role')
      .lean();

    // 2) Existing account with the same verified email: link it
    if (!user && email && emailVerified) {
      user = await this.userModel
        .findOneAndUpdate({ email }, { $set: { appleId } }, { new: true })
        .select('role email isActive')
        .populate<{ role: Role | null }>('role')
        .lean();
    }

    // 3) New account
    if (!user) {
      if (!email) {
        throw new BadRequestException(
          this.i18n.translate('exception.OAUTH_EMAIL_REQUIRED'),
        );
      }
      const userRole = await this.roleModel.findOne({ name: 'User' });
      const newUser = await this.userModel.create({
        email,
        name: oauthDisplayName(profile.name, email, 'Apple User'),
        password: crypto.randomBytes(16).toString('hex'),
        provider: 'apple',
        appleId,
        role: userRole ? userRole._id : undefined,
        lastLogin: new Date(),
      });
      return this.tokenService.generate_Tokens({
        user_id: newUser._id.toString(),
        role: userRole?.name || 'User',
        level: userRole ? userRole.level : 1,
        email: newUser.email,
        permissions: userRole ? userRole.permissions : [],
      });
    }

    if (!user.isActive) {
      throw new BadRequestException(
        this.i18n.translate('exception.ACCOUNT_BLOCKED'),
      );
    }
    await this.userModel.findByIdAndUpdate(user._id, {
      $set: { lastLogin: new Date() },
    });
    return this.tokenService.generate_Tokens({
      user_id: user._id.toString(),
      role: user.role?.name || 'User',
      level: user.role?.level || 0,
      email: user.email,
      permissions: user.role?.permissions || [],
    });
  }
}
