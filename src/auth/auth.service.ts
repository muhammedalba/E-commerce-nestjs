import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto, UserRole } from 'src/users/shared/dto/create-user.dto';

import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import * as bcrypt from 'bcrypt';
import { RefreshToken } from './shared/schema/refresh-token.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { ForgotPasswordDto } from './shared/Dto/forgotPassword.dto.';
import { LoginUserDto } from './shared/Dto/login.dto';
import { resetCodeDto } from './shared/Dto/resetCode.dto';
import { UpdateUserDto } from 'src/users/shared/dto/update-user.dto';
import { RefreshTokenDto } from './shared/Dto/refresh-Token.Dto';
import { CookieService } from './shared/services/cookie.service';
import { Request, Response } from 'express';
import { PasswordResetService } from './shared/services/password-reset.service';
import { userProfileService } from './shared/services/user-profile.service';
import { tokenService } from 'src/auth/shared/services/token.service';
import { googleService } from './oauth2/services/google.service';
import { facebookService } from './oauth2/services/facebook.service';
import { MulterFile } from 'src/shared/utils/interfaces/fileInterface';
import { User } from './shared/schema/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly fileUploadService: FileUploadService,
    private readonly i18n: CustomI18nService,
    private readonly tokenService: tokenService,
    private readonly passwordResetService: PasswordResetService,
    private readonly userProfileService: userProfileService,
    private readonly cookieService: CookieService,
    private readonly googleService: googleService,
    private readonly facebookService: facebookService,
  ) {}

  // --- register user --- //
  async register(
    createUserDto: CreateUserDto,
    file: MulterFile,
    res: Response,
  ): Promise<any> {
    const { email } = createUserDto;
    //1) check email if is in use
    const isExists = await this.userModel.exists({
      email: email,
    });
    if (isExists) {
      throw new BadRequestException(
        this.i18n.translate('exception.EMAIL_EXISTS'),
      );
    }

    //2) file upload service (save image in disk storage)
    let filePath = `/${process.env.UPLOADS_FOLDER}/users/avatar.png`;
    if (file) {
      try {
        filePath = await this.fileUploadService.saveFileToDisk(file, 'users');
      } catch (error) {
        console.error('File upload failed:', error);
        throw new InternalServerErrorException(
          this.i18n.translate('exception.ERROR_FILE_UPLOAD'),
        );
      }
    }
    //3) save user to db with avatar path
    createUserDto.avatar = filePath;
    // reset role to user
    createUserDto.role = UserRole.USER;
    const newUser = await this.userModel.create(createUserDto);
    //4) generate refresh token and access token and save the refresh token in database and delete old refresh token
    const userId = {
      user_id: newUser._id.toString(),
      role: UserRole.USER,
      email: newUser.email,
    };

    const Tokens = await this.tokenService.generate_Tokens(userId, '1h');
    // 5) Set cookies using CookieService
    this.cookieService.setRefreshTokenCookie(res, Tokens.refresh_Token);
    this.cookieService.setAccessTokenCookie(res, Tokens.access_token);
    //6) update avatar url and tokens
    newUser.avatar = `${process.env.BASE_URL}${filePath}`;
    // handel response
    const userWithTokens = {
      ...newUser.toObject(),
      password: undefined,
      __v: undefined,
    };
    return {
      status: 'success',
      message: this.i18n.translate('success.LOGIN_SUCCESS'),
      data: userWithTokens,
      access_token: Tokens.access_token,
    };
  }
  async login(
    loginUserDto: LoginUserDto,
    res: Response,
  ): Promise<{
    status: string;
    message: string;
    data: any;
    access_token: string;
  }> {
    const { email, password } = loginUserDto;
    // 1) Find user by email
    const user = await this.userModel
      .findOne({ email })
      .select('password email role avatar name ')
      .lean();

    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.INVALID_LOGIN'),
      );
    }
    // 2) check password is valid
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new BadRequestException(
        this.i18n.translate('exception.INVALID_LOGIN'),
      );
    }

    // 3) generate RefreshToken and access token and save the refresh token in database and delete old refresh token
    const userId = {
      user_id: user._id.toString(),
      role: user.role || 'user',
      email: user.email,
    };
    const Tokens = await this.tokenService.generate_Tokens(userId, '1h');
    // 4) Set cookies using CookieService
    this.cookieService.setRefreshTokenCookie(res, Tokens.refresh_Token);
    this.cookieService.setAccessTokenCookie(res, Tokens.access_token);

    // 5) Clean user data before returning
    const userResponse = {
      ...user,
      avatar: `${process.env.BASE_URL}${user.avatar}`,
      password: undefined,
    };

    return {
      status: 'success',
      message: this.i18n.translate('success.LOGIN_SUCCESS'),
      data: userResponse,
      access_token: Tokens.access_token,
    };
  }
  async logout(
    req: { user: { user_id: string } },
    res: Response,
  ): Promise<{ message: string }> {
    // 1) check if user is logged in
    if (!req.user) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_LOGGED'),
      );
    }
    // delete  refresh tokens for the user
    try {
      await this.RefreshTokenModel.deleteOne({
        userId: req.user.user_id,
      });
      // remove cookies
      this.cookieService.clearCookies(res);
      return { message: this.i18n.translate('success.LOGOUT_SUCCESS') };
    } catch {
      throw new BadRequestException(
        this.i18n.translate('exception.ERROR_LOGOUT'),
      );
    }
  }
  async getMe(request: {
    user: { user_id: string; role: string };
  }): Promise<any> {
    return await this.userProfileService.getMe(request);
  }
  async updateMe(
    userId: { user: { user_id: string } },
    updateUserDto: UpdateUserDto,
    file: MulterFile,
  ): Promise<any> {
    return await this.userProfileService.updateMe(userId, updateUserDto, file);
  }
  async changeMyPassword(
    userId: { user: { user_id: string } },
    updateUserDto: UpdateUserDto,
  ): Promise<any> {
    return await this.userProfileService.changeMyPassword(
      userId,
      updateUserDto,
    );
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<any> {
    return await this.passwordResetService.forgotPassword(forgotPasswordDto);
  }

  async verify_Pass_Reset_Code(resetCode: resetCodeDto): Promise<any> {
    return await this.passwordResetService.verify_Pass_Reset_Code(resetCode);
  }
  async resetPassword(LoginUserDto: LoginUserDto, res: Response): Promise<any> {
    return await this.passwordResetService.resetPassword(LoginUserDto, res);
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
    req: Request,
    res: Response,
  ): Promise<any> {
    return await this.userProfileService.refreshToken(
      refreshTokenDto,
      req,
      res,
    );
  }
  async googleLogin(
    googleUser: {
      email: string;
      name: string;
      picture: string;
      provider: string;
      providerId: string;
    },
    res: Response,
  ) {
    return await this.googleService.googleLogin(googleUser, res);
  }
  async facebookLogin(
    facebookUser: {
      email: string;
      name: string;
      picture: string;
      provider: string;
      facebookId: string;
    },
    res: Response,
  ) {
    return await this.facebookService.facebookLogin(facebookUser, res);
  }
}
