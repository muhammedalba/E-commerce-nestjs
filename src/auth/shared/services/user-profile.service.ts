import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';

import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';

import { EmailService } from 'src/email/email.service';
import { RefreshToken } from '../schema/refresh-token.schema';
import { UpdateUserDto } from 'src/users/shared/dto/update-user.dto';
import { RefreshTokenDto } from '../Dto/refresh-Token.Dto';
import { JwtService } from '@nestjs/jwt';
import { CookieService } from './cookie.service';
import { Request, Response } from 'express';
import { tokenService } from 'src/auth/shared/services/token.service';
import { User } from '../schema/user.schema';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class userProfileService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly i18n: CustomI18nService,
    private readonly fileUploadService: FileUploadService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly cookieService: CookieService,
    private readonly tokenService: tokenService,
  ) {}
  async getMe(user_id: string): Promise<any> {
    // 1) get user from database
    const user = await this.userModel
      .findById(user_id)
      .select('-__v -role -slug -password')
      .lean()
      .exec();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.USER_NOT_FOUND'),
      );
    }
    return {
      status: 'success',
      data: user,
    };
  }
  async updateMe(
    user_id: string,
    updateUserDto: UpdateUserDto,
    file: MulterFileType,
  ): Promise<any> {
    //1) check if user exists
    const user = await this.userModel
      .findById(user_id)
      .select('avatar email')
      .lean();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.USER_NOT_FOUND'),
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

    // 3) update user avatar if new file is provided
    if (file) {
      const avatarPath = await this.fileUploadService.updateFile(
        file,
        'users',
        user,
      );
      // 4) update user avatar
      updateUserDto.avatar = avatarPath;
    }
    // 4) update user in the database
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        { _id: user._id },
        {
          $set: {
            name: updateUserDto.name,
            email: updateUserDto.email,
            avatar: updateUserDto.avatar,
          },
        },
        { new: true, runValidators: true },
      )
      .select('-__v');

    return {
      status: 'success',
      message: this.i18n.translate('success.updated_SUCCESS'),
      data: updatedUser,
    };
  }
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
      // 5) send email to user
      await this.emailService.send_reset_password_success(
        user.email,
        user.name,
        `${process.env.BASE_URL}/auth/login`,
        `${process.env.BASE_URL}/auth/login`,
        'Password reset successfully',
      );
    } catch {
      throw new BadGatewayException(
        this.i18n.translate('exception.EMAIL_SEND_FAILED'),
      );
    }

    return {
      status: 'success',
      message: this.i18n.translate('success.updated_SUCCESS'),
      data: user,
    };
  }
  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
    req: Request,
    res: Response,
  ) {
    const cookies = req.cookies as { refresh_token?: string };
    const refreshToken = cookies.refresh_token?.trim() || '';

    if (!refreshToken) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_FOUND', {
          args: { variable: 'refresh token' },
        }),
      );
    }
    //1) find refresh token from database
    const tokenDoc = await this.RefreshTokenModel.findOne({
      refresh_Token: refreshToken,
    })
      .select('refresh_Token expiryDate')
      .lean()
      .exec();

    if (!tokenDoc) {
      throw new BadRequestException(
        this.i18n.translate('exception.TOKEN_INVALID'),
      );
    }
    // check expiryDate refresh token
    const isExpired = tokenDoc.expiryDate.getTime() < Date.now();
    if (isExpired) {
      // delete old refresh token
      await this.RefreshTokenModel.deleteOne({
        refresh_Token: refreshToken,
      });
      throw new BadRequestException(
        this.i18n.translate('exception.REFRESH_TOKEN_EXPIRED'),
      );
    }
    //2) Verify ACCESS  token
    let decoded_access_token: JwtPayload;
    try {
      decoded_access_token = await this.jwtService.verifyAsync<JwtPayload>(
        refreshTokenDto.access_token,
      );
    } catch {
      throw new BadRequestException(
        this.i18n.translate('exception.TOKEN_INVALID'),
      );
    }

    //3) verify user data from decoded token
    const userData = {
      user_id: decoded_access_token.user_id,
      role: decoded_access_token.role || 'user',
      email: decoded_access_token.email,
    };
    // generate new access and refresh token and delete old refresh token
    const new_Tokens = await this.tokenService.generate_Tokens(userData, '1d');
    // 4) Set cookies using CookieService
    this.cookieService.setRefreshTokenCookie(res, new_Tokens.refresh_Token);
    this.cookieService.setAccessTokenCookie(res, new_Tokens.access_token);

    return {
      status: 'success',
      message: this.i18n.translate('success.updated_REFRESH_SUCCESS'),
      access_token: new_Tokens.access_token,
    };
  }
}
