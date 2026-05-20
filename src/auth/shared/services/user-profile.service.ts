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
import { JwtService } from '@nestjs/jwt';
import { CookieService } from './cookie.service';
import { Request, Response } from 'express';
import { TokenService } from 'src/auth/shared/services/token.service';
import { User } from '../schema/user.schema';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly i18n: CustomI18nService,
    private readonly fileUploadService: FileUploadService,
    private readonly jwtService: JwtService,
    private readonly cookieService: CookieService,
    private readonly tokenService: TokenService,
  ) {}
  // ==========================================================================
  // =========================== get my profile ===========================
  // ==========================================================================
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
  // ==========================================================================
  // =========================== update my profile ===========================
  // ==========================================================================
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

  // ==========================================================================
  // =========================== change my password ===========================
  // ==========================================================================
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
  // ==========================================================================
  // =========================== refresh token ===========================
  // ==========================================================================
  async refreshToken(req: Request, res: Response) {
    const cookies = req.cookies as {
      refresh_token?: string;
      access_token?: string;
    };
    const refreshToken = cookies.refresh_token?.trim() || '';
    const access_token = cookies.access_token?.trim() || '';

    if (!refreshToken) {
      throw new BadRequestException(
        this.i18n.translate('exception.REFRESH_TOKEN_NOT_FOUND'),
      );
    }
    //1) find refresh token from database
    const tokenDoc = await this.RefreshTokenModel.findOne({
      refresh_Token: refreshToken,
    })
      .select('refresh_Token expiryDate')
      .lean()
      .exec();
    console.log(tokenDoc, 'tokenDoc');
    console.log(refreshToken, 'refreshToken');
    console.log(access_token, 'access_token');
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
    //2) Verify ACCESS  token
    let decoded_access_token: JwtPayload;
    try {
      decoded_access_token = await this.jwtService.verifyAsync<JwtPayload>(
        access_token,
        {
          ignoreExpiration: true,
        },
      );
    } catch {
      throw new BadRequestException(
        this.i18n.translate('exception.TOKEN_INVALID'),
      );
    }

    //3) verify user data from decoded token
    const userData = {
      user_id: decoded_access_token.user_id,
      role: decoded_access_token.role || 'User',
      level: decoded_access_token.level || 0,
      email: decoded_access_token.email,
      permissions: decoded_access_token.permissions || [],
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
