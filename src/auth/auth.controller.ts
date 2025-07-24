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
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/users/shared/dto/create-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { LoginUserDto } from './shared/Dto/login.dto';
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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Authenticate with Google' })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to Google for authentication.',
  })
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {}

  @ApiOperation({ summary: 'Google authentication redirect callback' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Successful Google authentication and user login/registration.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User information is missing.',
  })
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

  @ApiOperation({ summary: 'Authenticate with Facebook' })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to Facebook for authentication.',
  })
  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  facebookLogin() {}

  @ApiOperation({ summary: 'Facebook authentication redirect callback' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Successful Facebook authentication and user login/registration.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User information is missing.',
  })
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

  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginUserDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully logged in.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized. Invalid credentials.',
  })
  @Post('login')
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    return await this.authService.login(loginUserDto, res);
  }

  @ApiOperation({ summary: 'Register a new user' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'User avatar image',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid input data or email already exists.',
  })
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

  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBearerAuth() // Indicates that this endpoint requires authentication
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Access token successfully refreshed.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized. Invalid or expired refresh token.',
  })
  @Get('refresh-token')
  // @UseGuards(AuthGuard) // Uncomment if AuthGuard is needed for refresh token endpoint
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    return await this.authService.refreshToken(req, res);
  }

  @ApiOperation({ summary: 'User logout' })
  @ApiBearerAuth()
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully logged out.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(
    @Req() request: { user: JwtPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    return await this.authService.logout(request, res);
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth()
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @Get('me-profile')
  @UseGuards(AuthGuard)
  async getMe(@Req() request: { user: JwtPayload }): Promise<any> {
    return await this.authService.getMe(request);
  }

  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent successfully.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid email or user not found.',
  })
  @Post('forgot-password')
  async forgotPassword(
    @Body() forgotPassword: ForgotPasswordDto,
  ): Promise<any> {
    return await this.authService.forgotPassword(forgotPassword);
  }

  @ApiOperation({ summary: 'Reset user password' })
  @ApiBody({
    type: LoginUserDto,
    description: 'Provide email and new password',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password successfully reset.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid reset code or new password.',
  })
  @Patch('reset-password')
  async resetPassword(@Body() LoginUserDto: LoginUserDto): Promise<any> {
    return this.authService.resetPassword(LoginUserDto);
  }

  @ApiOperation({ summary: 'Verify password reset code' })
  @ApiBody({ type: resetCodeDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reset code verified successfully.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid or expired reset code.',
  })
  @Post('verify-Pass-Reset-Code')
  async verify_Pass_Reset_Code(@Body() code: resetCodeDto): Promise<any> {
    return this.authService.verify_Pass_Reset_Code(code);
  }

  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'User avatar image',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile updated successfully.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid input data.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
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

  @ApiOperation({ summary: 'Change current user password' })
  @ApiBearerAuth()
  @ApiBody({
    type: UpdateUserDto,
    description: 'Provide current and new password',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request. Invalid current password or new password.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  @Patch('changeMyPassword')
  @UseGuards(AuthGuard)
  async changeMyPassword(
    @Req() request: { user: JwtPayload },
    @Body() UpdateUserDto: UpdateUserDto,
  ): Promise<any> {
    return await this.authService.changeMyPassword(request, UpdateUserDto);
  }
}
