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

/**
 * Service responsible for managing Facebook OAuth2 authentication.
 * Handles user verification, automatic account provisioning, role assignment,
 * token generation, cookie management, and redirection to the frontend application.
 */
@Injectable()
export class FacebookService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Role.name) private roleModel: Model<Role>,
    private readonly i18n: CustomI18nService,
    private readonly tokenService: TokenService,
    private readonly cookieService: CookieService,
  ) {}

  /**
   * Processes Facebook OAuth login and registration callback.
   *
   * Workflow:
   * 1. Looks up the user by email extracted from the Facebook profile.
   * 2. If the user does not exist:
   *    - Creates a new user record with provider 'facebook' and a randomized password.
   *    - Assigns the default 'User' role.
   *    - Generates authentication tokens and attaches them to cookies.
   * 3. If the user already exists:
   *    - Verifies the account is active; throws a BadRequestException if blocked.
   *    - Updates the lastLogin timestamp.
   *    - Generates fresh authentication tokens and attaches them to cookies.
   * 4. Redirects the client to the frontend application origin.
   *
   * @param facebookUser - User profile payload received from Facebook OAuth strategy
   * @param res - Express response object for setting cookies and executing the redirect
   * @throws {BadRequestException} When the existing user account is deactivated
   * @returns Redirects to the configured frontend origin
   */
  async facebookLogin(facebookUser: FacebookOAuthUser, res: Response) {
    const { email, name, picture } = facebookUser;

    // Step 1: Check if a user already exists with this email address
    const user = await this.userModel
      .findOne({ email: email })
      .select('name role email avatar isActive')
      .populate('role')
      .lean();

    let Tokens: { refresh_Token: string; access_token: string };

    if (!user) {
      // Step 2a: Generate a cryptographically secure random password for OAuth user
      const randomPassword = crypto.randomBytes(16).toString('hex');

      // Step 2b: Retrieve default 'User' role
      const userRole = await this.roleModel.findOne({ name: 'User' });

      // Step 2c: Provision new user account
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
        role: userRole?.name || 'User',
        level: userRole ? userRole.level : 1,
        email: newUser.email,
        permissions: userRole ? userRole.permissions : [],
      };

      // Step 2d: Generate JWT access and refresh tokens
      Tokens = await this.tokenService.generate_Tokens(userId);

      // Step 2e: Attach tokens to secure HTTP cookies
      this.cookieService.setCookies(res, Tokens);
    } else {
      // Step 3a: Check if existing account is active
      if (!user.isActive) {
        throw new BadRequestException(
          this.i18n.translate('exception.ACCOUNT_BLOCKED'),
        );
      }

      const roleObj = user.role as Role;
      const userId = {
        user_id: user._id.toString(),
        role: roleObj?.name || 'user',
        level: roleObj?.level || 0,
        email: user.email,
        permissions: roleObj?.permissions || [],
      };

      // Step 3b: Generate fresh JWT tokens
      Tokens = await this.tokenService.generate_Tokens(userId);

      // Step 3c: Update last login timestamp
      await this.userModel.findByIdAndUpdate(user._id, {
        $set: { lastLogin: new Date() },
      });

      // Step 3d: Attach updated tokens to secure cookies
      this.cookieService.setCookies(res, Tokens);
    }

    // Step 4: Redirect user back to the frontend application
    return res.redirect(`${process.env.FRONTEND_ORIGIN}`);
  }
}
