import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/users/shared/dto/create-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { LoginUserDto } from 'src/auth/shared/Dto/login.dto';
import { RefreshTokenDto } from './shared/Dto/refresh-Token.Dto';
import { AuthGuard } from './shared/guards/auth.guard';
import { ForgotPasswordDto } from './shared/Dto/forgotPassword.dto.';
import { resetCodeDto } from './shared/Dto/resetCode.dto';
import { UpdateUserDto } from 'src/users/shared/dto/update-user.dto';
import { Request, Response } from 'express';
import { GoogleAuthGuard } from './oauth2/guards/GoogleAuthGuard';
import { FacebookAuthGuard } from './oauth2/guards/facebook-auth.guard';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import {
  FacebookOAuthUser,
  OAuthUser,
} from './shared/types/oauth-user.interface';
import { JwtPayload } from './shared/types/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /*
   * public: /api/v1/google
   * method: GET
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {}
  /*
   * public: /api/v1/google/redirect
   * method: GET
   */
  @Get('google/redirect')
  @UseGuards(GoogleAuthGuard)
  googleAuthRedirect(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User information is missing.');
    }
    return this.authService.googleLogin(user as unknown as OAuthUser, res);
  }
  /*
   * public: /api/v1/facebook
   * method: GET
   */
  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  facebookLogin() {}

  @Get('facebook/redirect')
  @UseGuards(FacebookAuthGuard)
  facebookLoginRedirect(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('User information is missing.');
    }
    return this.authService.facebookLogin(
      user as unknown as FacebookOAuthUser,
      res,
    );
  }
  /*
   * public: /api/v1/auth
   * method: POST
   */
  @Post('login')
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    return await this.authService.login(loginUserDto, res);
  }
  /*
   * public: /api/v1/auth/register
   * method: POST
   */
  @Post('register')
  @UseInterceptors(FileInterceptor('avatar'))
  async register(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ): Promise<any> {
    // Implement registration logic
    return await this.authService.register(createUserDto, file, res);
  }
  /*
   * public: /api/v1/auth/refresh-token
   * method: POST
   */
  @Post('refresh-token')
  @UseGuards(AuthGuard)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    return await this.authService.refreshToken(refreshTokenDto, req, res);
  }
  /*
   * public: /api/v1/auth/logout
   * method: POST
   */
  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(
    @Req() request: { user: { user_id: string } },
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    return await this.authService.logout(request, res);
  }
  @Get('me-profile')
  @UseGuards(AuthGuard)
  async getMe(@Req() request: { user: JwtPayload }): Promise<any> {
    return await this.authService.getMe(request);
  }
  /*
   * public: /api/v1/auth/forgot-password
   * method: POST
   */
  @Post('forgot-password')
  async forgotPassword(
    @Body() forgotPassword: ForgotPasswordDto,
  ): Promise<any> {
    return await this.authService.forgotPassword(forgotPassword);
  }
  /*
   * public: /api/v1/auth/verify-code
   * method: POST
   */
  @Put('reset-password')
  async resetPassword(
    @Body() LoginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    return this.authService.resetPassword(LoginUserDto, res);
  }
  /*
   * public: /api/v1/auth/verify-Pass-Reset-Code
   * method: POST
   */
  @Post('verify-Pass-Reset-Code')
  async verify_Pass_Reset_Code(@Body() code: resetCodeDto): Promise<any> {
    return this.authService.verify_Pass_Reset_Code(code);
  }
  /*
   * public: /api/v1/auth/updateMe
   * method: POST
   */
  @Put('updateMe')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  async updateMe(
    @Req() request: { user: { user_id: string } },
    @Body() UpdateUserDto: UpdateUserDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: MulterFileType,
  ): Promise<any> {
    return await this.authService.updateMe(request, UpdateUserDto, file);
  }
  /*
   * public: /api/v1/auth/changeMyPassword
   * method: POST
   */
  @Put('changeMyPassword')
  @UseGuards(AuthGuard)
  async changeMyPassword(
    @Req() request: { user: { user_id: string } },
    @Body() UpdateUserDto: UpdateUserDto,
  ): Promise<any> {
    return await this.authService.changeMyPassword(request, UpdateUserDto);
  }
}
