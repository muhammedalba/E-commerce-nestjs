import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as path from 'path';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

import { RefreshToken } from '../schema/refresh-token.schema';
import { UpdateUserDto } from 'src/users/shared/dto/update-user.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { CookieService } from './cookie.service';
import { Request, Response } from 'express';
import { TokenService } from 'src/auth/shared/services/token.service';
import { User } from '../schema/user.schema';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import * as bcrypt from 'bcrypt';
import {
  USER_EVENTS,
  UserDeletedEvent,
} from 'src/users/shared/events/user.events';

/** Level of the default customer role; staff roles sit above it. */
const CUSTOMER_ROLE_LEVEL = 1;

/**
 * Handles authenticated user profile operations and token lifecycle management.
 *
 * @description This service is responsible for:
 * - Retrieving and updating the authenticated user's profile (name, email, phone, avatar).
 * - Changing the user's password with automatic session invalidation.
 * - Rotating access/refresh tokens using a secure, DB-backed refresh flow (RFC 6749 compliant).
 *
 * @security
 * - The {@link refreshToken} method fetches fresh user data from the database on every call,
 *   ensuring that permission changes and account blocks take effect immediately.
 * - Password changes automatically revoke all existing refresh tokens for the user.
 * - All file operations include rollback logic to prevent orphaned uploads on failure.
 */
@Injectable()
export class UserProfileService {
  constructor(
    /** BullMQ queue for dispatching asynchronous email jobs (e.g., password-reset confirmations). */
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly i18n: CustomI18nService,
    private readonly fileUploadService: FileUploadService,
    private readonly cookieService: CookieService,
    private readonly tokenService: TokenService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private readonly logger = new Logger(UserProfileService.name);
  /**
   * Retrieves the authenticated user's profile.
   *
   * @param user_id - The MongoDB ObjectId of the authenticated user (extracted from JWT payload).
   * @returns The user document containing: `name`, `avatar`, `email`, `phone`, `role`, `slug`, `lastLogin`.
   *          The `avatar` field is resolved to an absolute URL.
   * @throws {BadRequestException} If no user is found with the given ID.
   */
  async getMe(user_id: string): Promise<any> {
    // 1) get user from database
    const user = await this.userModel
      .findById(user_id)
      .select(
        'isActive name avatar email phone role slug lastLogin totalOrder provider',
      )
      .populate('role')
      .lean()
      .exec();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.USER_NOT_FOUND'),
      );
    }
    // 1.5) build absolute avatar URL (lean() bypasses Mongoose virtuals/hooks)
    user.avatar = this.fileUploadService.withBaseUrl(user.avatar);

    return user;
  }
  /**
   * Updates the authenticated user's profile information.
   *
   * @description Handles three avatar scenarios:
   * 1. **New file uploaded** → replaces the old avatar on disk and updates the path.
   * 2. **Explicit `null` sent** → deletes the current avatar and resets to the default.
   * 3. **No avatar field** → preserves the existing avatar unchanged.
   *
   * If the database update fails after a new file was saved, the orphaned file is cleaned up.
   *
   * @param user_id - The MongoDB ObjectId of the authenticated user.
   * @param updateUserDto - DTO containing the fields to update (`name`, `email`, `phone`, `avatar`).
   * @param file - Optional new avatar file (Multer upload).
   * @returns The updated user document with the `avatar` resolved to an absolute URL.
   * @throws {BadRequestException} If the user is not found, is blocked, or the new email is already in use.
   */
  async updateMe(
    user_id: string,
    updateUserDto: UpdateUserDto,
    file: MulterFileType,
  ): Promise<any> {
    //1) check if user exists
    const user = await this.userModel
      .findById(user_id)
      .select('avatar email isActive phone')
      .lean();

    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.USER_NOT_FOUND'),
      );
    }
    if (!user.isActive) {
      throw new BadRequestException(
        this.i18n.translate('exception.ACCOUNT_BLOCKED'),
      );
    }
    // 2) check if email is in use
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const emailInUse = await this.userModel.exists({
        email: updateUserDto.email,
        _id: { $ne: user._id },
      });
      if (emailInUse) {
        throw new BadRequestException(
          this.i18n.translate('exception.EMAIL_EXISTS'),
        );
      }
    }

    if (!updateUserDto.phone) {
      updateUserDto.phone = user.phone;
    }

    let newAvatarPath: FileAsset | undefined = undefined;
    // 3) update user avatar if new file is provided
    if (file) {
      newAvatarPath = await this.fileUploadService.updateFile(
        file,
        User.name,
        user.avatar,
      );
      // 4) update user avatar
      if (newAvatarPath) {
        updateUserDto.avatar = { ...newAvatarPath };
      }
    } else if (
      updateUserDto.avatar === null ||
      (updateUserDto.avatar as any) === 'null'
    ) {
      if (user.avatar) {
        // ✅ تجاهل خطأ الحذف بصمت حتى لا يتعطل التحديث
        await this.fileUploadService.deleteFile(user.avatar).catch(() => {});
      }
      // ✅ مسار ديناميكي آمن بدلاً من النص الثابت
      const uploadsDir = process.env.UPLOADS_FOLDER || 'uploads';
      const defaultRelPath = path.posix.join(
        '/',
        uploadsDir,
        User.name,
        'avatar.png',
      );
      updateUserDto.avatar = {
        url: defaultRelPath,
        publicId: defaultRelPath,
        provider: 'local',
      };
    } else {
      // إذا لم يرسل ملف ولم يرسل null، نحذف الحقل من الـ DTO حتى لا يمسح الصورة القديمة
      delete updateUserDto.avatar;
    }
    try {
      // 4) update user in the database
      const updatedUser = await this.userModel
        .findByIdAndUpdate(
          user._id,
          {
            $set: {
              name: updateUserDto.name,
              email: updateUserDto.email,
              phone:
                updateUserDto.phone !== undefined
                  ? updateUserDto.phone
                  : user.phone,
              avatar: updateUserDto.avatar,
            },
          },
          { new: true, runValidators: true, lean: true },
        )
        .select('name avatar phone email role slug lastLogin')
        .populate('role');
      // build absolute avatar URL (lean() bypasses Mongoose virtuals/hooks)
      if (updatedUser) {
        updatedUser.avatar = this.fileUploadService.withBaseUrl(
          updatedUser.avatar,
        );
      }
      return updatedUser;
    } catch (error) {
      if (newAvatarPath) {
        await this.fileUploadService.deleteFile(newAvatarPath).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Changes the authenticated user's password and invalidates all active sessions.
   *
   * @description Workflow:
   * 1. Updates the password in the database (hashing is handled by a Mongoose `pre` hook).
   * 2. Deletes the user's refresh token to force re-authentication on all devices.
   * 3. Dispatches an async email notification via BullMQ confirming the password change.
   *
   * @param user_id - The MongoDB ObjectId of the authenticated user.
   * @param updateUserDto - DTO containing the new `password` field.
   * @returns The updated user document (`name`, `email`).
   * @throws {BadRequestException} If no user is found with the given ID.
   * @throws {BadGatewayException} If the email job fails to enqueue (typically Redis is down).
   */
  async changeMyPassword(
    user_id: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<any> {
    // 1) find user and select password field
    const userInDb = await this.userModel.findById(user_id).select('password');
    if (!userInDb) {
      throw new BadRequestException(
        this.i18n.translate('exception.USER_NOT_FOUND'),
      );
    }

    // 2) verify current password
    const isPasswordMatch = await bcrypt.compare(
      changePasswordDto.currentPassword,
      userInDb.password,
    );

    if (!isPasswordMatch) {
      throw new BadRequestException(
        this.i18n.translate('exception.INVALID_CURRENT_PASSWORD'),
      );
    }

    // 3) update user password
    const user = await this.userModel
      .findByIdAndUpdate(
        { _id: user_id },
        {
          $set: {
            password: changePasswordDto.password,
          },
        },
        { new: true, runValidators: true },
      )
      .select('name email')
      .lean();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.USER_NOT_FOUND'),
      );
    }
    // 4) delete refresh tokens for the user (every device's session, so a
    // stolen session can't outlive the password it was opened with)
    try {
      await this.RefreshTokenModel.deleteMany({
        userId: user_id,
      }).lean();

      // 5) Send email to user via Background Job (Queue)
      await this.mailQueue.add('send-reset-success', {
        email: user.email,
        name: user.name,
        supportLink: `${process.env.FRONTEND_ORIGIN}/login`,
        loginLink: `${process.env.FRONTEND_ORIGIN}/login`,
        message: 'Password reset successfully',
      });
    } catch {
      // It will only fail if Redis is down, not if SMTP fails
      throw new BadGatewayException(
        this.i18n.translate('exception.EMAIL_SEND_FAILED'),
      );
    }

    return user;
  }
  /**
   * Rotates the access and refresh tokens using only the refresh token.
   *
   * @description Implements a secure token rotation flow compliant with RFC 6749:
   * 1. Takes the refresh token from the request body (mobile clients) or the
   *    httpOnly `refresh_token` cookie (browsers).
   * 2. Validates the token exists in the database and has not expired.
   * 3. Fetches **fresh** user data (role, permissions, status) directly from the database
   *    — never from a stale JWT payload — ensuring real-time enforcement of permission
   *    changes and account blocks.
   * 4. Generates a new access token + refresh token pair (the old refresh token is
   *    automatically deleted by {@link TokenService.generate_Tokens}).
   * 5. Sets all auth cookies (`access_token`, `refresh_token`, `is_logged_in`) on the response,
   *    or, for a body-supplied token, returns the new refresh token in the body instead.
   *    The new pair keeps the session id, so logout still targets this device.
   *
   * @security
   * - Does **not** require the expired `access_token` — the `refresh_token` alone is the
   *   credential, following the OAuth 2.0 standard (Google, Auth0, AWS Cognito use this pattern).
   * - Blocked users (`isActive === false`) are denied refresh and fully logged out.
   * - Expired or invalid refresh tokens trigger full cookie cleanup to prevent stale `is_logged_in`.
   *
   * @param req - Express request (must contain `refresh_token` cookie; set via `path: /api/v1/auth/refresh-token`).
   * @param res - Express response (used to set new auth cookies).
   * @param bodyToken - Refresh token sent in the body by a mobile client.
   * @returns `{ message, access_token }` — the new access token for immediate client use,
   *          plus `refresh_token` when the token came from the body.
   * @throws {BadRequestException} If no refresh token is present in the body or cookies.
   * @throws {UnauthorizedException} If the refresh token is invalid, expired, or the user is blocked/deleted.
   */
  async refreshToken(req: Request, res: Response, bodyToken?: string) {
    const cookies = req.cookies as {
      refresh_token?: string;
    };
    const fromBody = !!bodyToken?.trim();
    const refreshToken =
      (fromBody ? bodyToken?.trim() : cookies.refresh_token?.trim()) || '';

    if (!refreshToken) {
      throw new BadRequestException(
        this.i18n.translate('exception.REFRESH_TOKEN_NOT_FOUND'),
      );
    }

    //1) Atomically delete the refresh token — if it's already gone, someone stole it.
    const tokenDoc = await this.RefreshTokenModel.findOneAndDelete({
      refresh_Token: refreshToken,
    })
      .select('refresh_Token expiryDate userId sessionId')
      .lean()
      .exec();

    if (!tokenDoc) {
      // Token not found: it was already consumed or never existed.
      // Treat as potential theft — revoke ALL tokens for this user as a safety measure.
      // We find the userId from a revoked-token fallback is not possible here,
      // so we simply reject the request. Frontend should redirect to login.
      this.cookieService.clearCookies(res);
      throw new UnauthorizedException(
        this.i18n.translate('exception.REFRESH_TOKEN_INVALID'),
      );
    }

    // check expiryDate refresh token
    const isExpired = tokenDoc.expiryDate.getTime() < Date.now();
    if (isExpired) {
      // Token was already deleted above; just clear cookies.
      this.cookieService.clearCookies(res);
      throw new UnauthorizedException(
        this.i18n.translate('exception.REFRESH_TOKEN_EXPIRED'),
      );
    }

    //2) Fetch fresh user data from database using userId from the refresh token
    const user = await this.userModel
      .findById(tokenDoc.userId)
      .select('email isActive role')
      .populate<{
        role: { name?: string; level?: number; permissions?: string[] };
      }>('role', 'name level permissions')
      .lean()
      .exec();

    if (!user) {
      await this.RefreshTokenModel.deleteMany({ userId: tokenDoc.userId });
      this.cookieService.clearCookies(res);
      throw new UnauthorizedException(
        this.i18n.translate('exception.USER_NOT_FOUND'),
      );
    }

    if (!user.isActive) {
      await this.RefreshTokenModel.deleteMany({ userId: tokenDoc.userId });
      this.cookieService.clearCookies(res);
      throw new UnauthorizedException(
        this.i18n.translate('exception.ACCOUNT_BLOCKED'),
      );
    }

    //3) build fresh user data payload
    const userData = {
      user_id: user._id.toString(),
      role: user.role?.name || 'User',
      level: user.role?.level || 0,
      email: user.email,
      permissions: user.role?.permissions || [],
    };
    // generate new access and refresh token in the same session (tokens
    // issued before sessions existed start one now)
    const new_Tokens = await this.tokenService.generate_Tokens(
      userData,
      undefined,
      tokenDoc.sessionId,
    );
    // 4) Set cookies, or return the refresh token to a mobile client
    const bodyTokens = this.cookieService.deliverTokens(
      res,
      new_Tokens,
      fromBody,
    );

    return {
      message: this.i18n.translate('success.updated_REFRESH_SUCCESS'),
      access_token: new_Tokens.access_token,
      ...bodyTokens,
    };
  }

  /**
   * Permanently deletes the authenticated customer's own account.
   *
   * @description Required by the App Store and Google Play for apps that let
   * users create accounts. Deletes the user, its avatar file and every session
   * (all devices), clears the browser cookies, then emits `user.deleted` so
   * dependent modules remove data owned by the user (reviews, cart, wishlist).
   * Orders are kept: they are financial records, and they stay valid without
   * the user document.
   *
   * @security
   * - Email/password accounts must confirm with their current password, so a
   *   stolen access token alone cannot delete the account. Social accounts
   *   have no usable password and rely on the access token.
   * - Staff accounts (any role above the customer role) are refused; they are
   *   removed from the dashboard, which guards the last administrator.
   *
   * @param userId - The authenticated user's id.
   * @param password - Current password (email/password accounts).
   * @param res - Express response used to clear auth cookies.
   * @throws {ForbiddenException} For staff accounts.
   * @throws {BadRequestException} If the password is missing or wrong.
   */
  async deleteMe(
    userId: string,
    password: string | undefined,
    res: Response,
  ): Promise<{ message: string }> {
    const user = await this.userModel
      .findById(userId)
      .select('password provider avatar role')
      .populate<{ role: { level?: number } | null }>('role', 'level')
      .lean()
      .exec();
    if (!user) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.USER_NOT_FOUND'),
      );
    }

    if ((user.role?.level ?? 0) > CUSTOMER_ROLE_LEVEL) {
      throw new ForbiddenException(
        this.i18n.translate('exception.ACCOUNT_DELETE_STAFF'),
      );
    }

    // Email/password accounts ('auth') confirm with the password
    if (!user.provider || user.provider === 'auth') {
      if (!password) {
        throw new BadRequestException(
          this.i18n.translate('exception.PASSWORD_REQUIRED'),
        );
      }
      if (!(await bcrypt.compare(password, user.password || ''))) {
        throw new BadRequestException(
          this.i18n.translate('exception.INVALID_CURRENT_PASSWORD'),
        );
      }
    }

    await this.userModel.deleteOne({ _id: user._id });
    await this.RefreshTokenModel.deleteMany({ userId });

    // Only uploaded avatars are files of ours (Google/Facebook ones are URLs)
    if (user.avatar && typeof user.avatar === 'object') {
      await this.fileUploadService.deleteFile(user.avatar).catch((err) => {
        this.logger.warn(
          `Avatar of deleted user ${userId} not removed: ${String(err)}`,
        );
      });
    }

    this.eventEmitter.emit(USER_EVENTS.DELETED, new UserDeletedEvent(userId));
    this.cookieService.clearCookies(res);

    return { message: this.i18n.translate('success.ACCOUNT_DELETED') };
  }
}
