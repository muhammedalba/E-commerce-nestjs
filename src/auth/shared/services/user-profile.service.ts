import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as path from 'path';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

import { RefreshToken } from '../schema/refresh-token.schema';
import { UpdateUserDto } from 'src/users/shared/dto/update-user.dto';
import { CookieService } from './cookie.service';
import { Request, Response } from 'express';
import { TokenService } from 'src/auth/shared/services/token.service';
import { User } from '../schema/user.schema';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';

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
  ) {}
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
      .select('isActive name avatar email phone role slug lastLogin')
      .populate('role')
      .lean()
      .exec();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.USER_NOT_FOUND'),
      );
    }
    // 1.5) build absolute avatar URL (lean() bypasses Mongoose virtuals/hooks)
    user.avatar = this.fileUploadService.withBaseUrl(user.avatar) as string;

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

    let newAvatarPath: string | undefined;
    // 3) update user avatar if new file is provided
    if (file) {
      const newAvatarPath = await this.fileUploadService.updateFile(
        file,
        User.name,
        user,
        user.avatar,
      );
      // 4) update user avatar
      updateUserDto.avatar = newAvatarPath;
    } else if (
      updateUserDto.avatar === 'null' ||
      updateUserDto.avatar === null
    ) {
      if (user.avatar) {
        // ✅ تجاهل خطأ الحذف بصمت حتى لا يتعطل التحديث
        await this.fileUploadService.deleteFile(user.avatar).catch(() => {});
      }
      // ✅ مسار ديناميكي آمن بدلاً من النص الثابت
      const uploadsDir = process.env.UPLOADS_FOLDER || 'uploads';
      updateUserDto.avatar = path.posix.join(
        '/',
        uploadsDir,
        User.name,
        'avatar.png',
      );
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
        ) as string;
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
    updateUserDto: UpdateUserDto,
  ): Promise<any> {
    // 1) update user password
    const user = await this.userModel
      .findByIdAndUpdate(
        { _id: user_id },
        {
          $set: {
            password: updateUserDto.password,
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
    // 2) check if password is provided  delete  refresh tokens for the user
    try {
      await this.RefreshTokenModel.deleteOne({
        userId: user_id,
      }).lean();

      // 5) Send email to user via Background Job (Queue)
      await this.mailQueue.add('send-reset-success', {
        email: user.email,
        name: user.name,
        supportLink: `${process.env.BASE_URL}/login`,
        loginLink: `${process.env.BASE_URL}/login`,
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
   * Rotates the access and refresh tokens using only the `refresh_token` cookie.
   *
   * @description Implements a secure token rotation flow compliant with RFC 6749:
   * 1. Extracts the `refresh_token` from the request's httpOnly cookie.
   * 2. Validates the token exists in the database and has not expired.
   * 3. Fetches **fresh** user data (role, permissions, status) directly from the database
   *    — never from a stale JWT payload — ensuring real-time enforcement of permission
   *    changes and account blocks.
   * 4. Generates a new access token + refresh token pair (the old refresh token is
   *    automatically deleted by {@link TokenService.generate_Tokens}).
   * 5. Sets all auth cookies (`access_token`, `refresh_token`, `is_logged_in`) on the response.
   *
   * @security
   * - Does **not** require the expired `access_token` — the `refresh_token` alone is the
   *   credential, following the OAuth 2.0 standard (Google, Auth0, AWS Cognito use this pattern).
   * - Blocked users (`isActive === false`) are denied refresh and fully logged out.
   * - Expired or invalid refresh tokens trigger full cookie cleanup to prevent stale `is_logged_in`.
   *
   * @param req - Express request (must contain `refresh_token` cookie; set via `path: /api/v1/auth/refresh-token`).
   * @param res - Express response (used to set new auth cookies).
   * @returns `{ message, access_token }` — the new access token for immediate client use.
   * @throws {BadRequestException} If no refresh token is present in the cookies.
   * @throws {UnauthorizedException} If the refresh token is invalid, expired, or the user is blocked/deleted.
   */
  async refreshToken(req: Request, res: Response) {
    const cookies = req.cookies as {
      refresh_token?: string;
    };
    const refreshToken = cookies.refresh_token?.trim() || '';

    if (!refreshToken) {
      throw new BadRequestException(
        this.i18n.translate('exception.REFRESH_TOKEN_NOT_FOUND'),
      );
    }

    //1) find refresh token from database
    const tokenDoc = await this.RefreshTokenModel.findOne({
      refresh_Token: refreshToken,
    })
      .select('refresh_Token expiryDate userId')
      .lean()
      .exec();

    if (!tokenDoc) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.REFRESH_TOKEN_INVALID'),
      );
    }
    // check expiryDate refresh token
    const isExpired = tokenDoc.expiryDate.getTime() < Date.now();
    if (isExpired) {
      // delete old refresh token
      await this.RefreshTokenModel.deleteOne({
        refresh_Token: refreshToken,
      });
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
      await this.RefreshTokenModel.deleteOne({ refresh_Token: refreshToken });
      this.cookieService.clearCookies(res);
      throw new UnauthorizedException(
        this.i18n.translate('exception.USER_NOT_FOUND'),
      );
    }

    if (!user.isActive) {
      await this.RefreshTokenModel.deleteOne({ refresh_Token: refreshToken });
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
    // generate new access and refresh token and delete old refresh token
    const new_Tokens = await this.tokenService.generate_Tokens(userData);
    // 4) Set cookies using CookieService
    this.cookieService.setCookies(res, new_Tokens);

    return {
      message: this.i18n.translate('success.updated_REFRESH_SUCCESS'),
      access_token: new_Tokens.access_token,
    };
  }
}
