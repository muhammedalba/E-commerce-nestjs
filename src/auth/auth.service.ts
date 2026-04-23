import { Injectable, Logger } from '@nestjs/common';
import { CreateUserDto } from 'src/users/shared/dto/create-user.dto';
import { ForgotPasswordDto } from './shared/dto/forgotPassword.dto.';
import { LoginUserDto } from './shared/dto/login.dto';
import { resetCodeDto } from './shared/dto/resetCode.dto';
import { UpdateUserDto } from 'src/users/shared/dto/update-user.dto';
import { Request, Response } from 'express';
import { PasswordResetService } from './shared/services/password-reset.service';
import { UserProfileService } from './shared/services/user-profile.service';
import { GoogleService } from './oauth2/services/google.service';
import { FacebookService } from './oauth2/services/facebook.service';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { JwtPayload } from './shared/types/jwt-payload.interface';
import { AuthCredentialService } from './shared/services/auth-credential.service';
import {
  FacebookOAuthUser,
  OAuthUser,
} from './shared/types/oauth-user.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authCredentialService: AuthCredentialService,
    private readonly passwordResetService: PasswordResetService,
    private readonly userProfileService: UserProfileService,
    private readonly googleService: GoogleService,
    private readonly facebookService: FacebookService,
  ) {}

  /* ------------ =============================== ---------- */
  /* ------------ ======  REGISTER  ====== ------------------- */
  /* ------------ =============================== ---------- */
  async register(
    createUserDto: CreateUserDto,
    file: MulterFileType,
    res: Response,
  ): Promise<any> {
    return await this.authCredentialService.register(createUserDto, file, res);
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  LOGIN  ====== ------------------- */
  /* ------------ =============================== ---------- */
  async login(loginUserDto: LoginUserDto, res: Response): Promise<any> {
    return await this.authCredentialService.login(loginUserDto, res);
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  LOGOUT  ====== ------------------- */
  /* ------------ =============================== ---------- */
  async logout(
    req: { user: { user_id: string } },
    res: Response,
  ): Promise<{ message: string }> {
    return await this.authCredentialService.logout(req, res);
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  GET ME PROFILE  ====== ---------- */
  /* ------------ =============================== ---------- */
  async getMe(request: { user: JwtPayload }): Promise<any> {
    return await this.userProfileService.getMe(request.user.user_id);
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  UPDATE ME  ====== ------------------- */
  /* ------------ =============================== ---------- */
  async updateMe(
    user_id: { user: JwtPayload },
    updateUserDto: UpdateUserDto,
    file: MulterFileType,
  ): Promise<any> {
    return await this.userProfileService.updateMe(
      user_id.user.user_id,
      updateUserDto,
      file,
    );
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  CHANGE MY PASSWORD  ====== ---------- */
  /* ------------ =============================== ---------- */
  async changeMyPassword(
    req: { user: JwtPayload },
    updateUserDto: UpdateUserDto,
  ): Promise<any> {
    return await this.userProfileService.changeMyPassword(
      req.user.user_id,
      updateUserDto,
    );
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  REFRESH TOKEN  ====== ---------- */
  /* ------------ =============================== ---------- */
  async refreshToken(req: Request, res: Response): Promise<any> {
    return await this.userProfileService.refreshToken(req, res);
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  FORGOT PASSWORD  ====== ---------- */
  /* ------------ =============================== ---------- */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<any> {
    return await this.passwordResetService.forgotPassword(forgotPasswordDto);
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  VERIFY PASS RESET CODE  ====== ---------- */
  /* ------------ =============================== ---------- */
  async verify_Pass_Reset_Code(resetCode: resetCodeDto): Promise<any> {
    return await this.passwordResetService.verify_Pass_Reset_Code(resetCode);
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  RESET PASSWORD  ====== ---------- */
  /* ------------ =============================== ---------- */
  async resetPassword(LoginUserDto: LoginUserDto): Promise<any> {
    return await this.passwordResetService.resetPassword(LoginUserDto);
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  GOOGLE LOGIN  ====== ---------- */
  /* ------------ =============================== ---------- */
  async googleLogin(googleUser: OAuthUser, res: Response) {
    return await this.googleService.googleLogin(googleUser, res);
  }

  /* ------------ =============================== ---------- */
  /* ------------ ======  FACEBOOK LOGIN  ====== ---------- */
  /* ------------ =============================== ---------- */
  async facebookLogin(facebookUser: FacebookOAuthUser, res: Response) {
    return await this.facebookService.facebookLogin(facebookUser, res);
  }
}
