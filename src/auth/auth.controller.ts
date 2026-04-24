import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/users/shared/dto/create-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { LoginUserDto } from './shared/dto/login-user.dto';
import { AuthGuard } from './shared/guards/auth.guard';
import { ForgotPasswordDto } from './shared/dto/forgot-password.dto';
import { ResetCodeDto } from './shared/dto/reset-code.dto';
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
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';

@Controller('auth')
@UseInterceptors(ClearCacheInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  // ------------ =============================== ---------- //
  // ------------ ======  GOOGLE AUTH  ====== ---------- //
  // ------------ =============================== ---------- //
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {}

  @Get('google/redirect')
  @UseGuards(GoogleAuthGuard)
  googleAuthRedirect(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    const user = (req as any).user;
    if (!user) {
      throw new BadRequestException('User information is missing.');
    }
    return this.authService.googleLogin(user as unknown as OAuthUser, res);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  FACEBOOK AUTH  ====== ---------- //
  // ------------ =============================== ---------- //
  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  facebookLogin() {}

  @Get('facebook/redirect')
  @UseGuards(FacebookAuthGuard)
  facebookLoginRedirect(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as any).user;
    if (!user) {
      throw new BadRequestException('User information is missing.');
    }
    return this.authService.facebookLogin(
      user as unknown as FacebookOAuthUser,
      res,
    );
  }
  // ------------ =============================== ---------- //
  // ------------ ======  LOGIN  ====== ---------- //
  // ------------ =============================== ---------- //
  @Post('login')
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    return await this.authService.login(loginUserDto, res);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  REGISTER  ====== ---------- //
  // ------------ =============================== ---------- //
  @Post('register')
  @UseInterceptors(FileInterceptor('avatar'))
  async register(
    @Res({ passthrough: true }) res: Response,
    @Body() createUserDto: CreateUserDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ): Promise<any> {
    return await this.authService.register(createUserDto, file, res);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  REFRESH TOKEN  ====== ---------- //
  // ------------ =============================== ---------- //
  @Get('refresh-token')
  // @UseGuards(AuthGuard) // Uncomment if AuthGuard is needed for refresh token endpoint
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    return await this.authService.refreshToken(req, res);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  LOGOUT  ====== ------------------- */
  /* ------------ =============================== ---------- */
  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(
    @Req() request: { user: JwtPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    return await this.authService.logout(request, res);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  GET ME PROFILE  ====== ---------- */
  /* ------------ =============================== ---------- */
  @Get('me-profile')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(30000) // 30 seconds
  @UseGuards(AuthGuard)
  async getMe(@Req() request: { user: JwtPayload }): Promise<any> {
    return await this.authService.getMe(request);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  FORGOT PASSWORD  ====== ---------- */
  /* ------------ =============================== ---------- */
  @Post('forgot-password')
  async forgotPassword(
    @Body() forgotPassword: ForgotPasswordDto,
  ): Promise<any> {
    return await this.authService.forgotPassword(forgotPassword);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  RESET PASSWORD  ====== ---------- */
  /* ------------ =============================== ---------- */
  @Patch('reset-password')
  async resetPassword(@Body() LoginUserDto: LoginUserDto): Promise<any> {
    return this.authService.resetPassword(LoginUserDto);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  VERIFY PASS RESET CODE  ====== ---------- */
  /* ------------ =============================== ---------- */
  @Post('verify-Pass-Reset-Code')
  async verify_Pass_Reset_Code(@Body() code: ResetCodeDto): Promise<any> {
    return this.authService.verify_Pass_Reset_Code(code);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  UPDATE ME  ====== ---------- */
  /* ------------ =============================== ---------- */
  @Put('updateMe')
  @UseGuards(AuthGuard)
  async updateMe(
    @Req() request: { user: JwtPayload },
    @Body() UpdateUserDto: UpdateUserDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ): Promise<any> {
    return await this.authService.updateMe(request, UpdateUserDto, file);
  }
  /* ------------ =============================== ---------- */
  /* ------------ ======  CHANGE MY PASSWORD  ====== ---------- */
  /* ------------ =============================== ---------- */
  @Patch('changeMyPassword')
  @UseGuards(AuthGuard)
  async changeMyPassword(
    @Req() request: { user: JwtPayload },
    @Body() UpdateUserDto: UpdateUserDto,
  ): Promise<any> {
    return await this.authService.changeMyPassword(request, UpdateUserDto);
  }
}

