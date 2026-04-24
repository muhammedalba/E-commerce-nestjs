import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from 'src/users/shared/dto/create-user.dto';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import * as bcrypt from 'bcrypt';
import { RefreshToken } from '../schema/refresh-token.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { LoginUserDto } from '../dto/login-user.dto';
import { CookieService } from './cookie.service';
import { TokenService } from './token.service';
import { User } from '../schema/user.schema';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { roles } from '../enums/role.enum';
import { Response } from 'express';

@Injectable()
export class AuthCredentialService {
  private readonly logger = new Logger(AuthCredentialService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly fileUploadService: FileUploadService,
    private readonly i18n: CustomI18nService,
    private readonly tokenService: TokenService,
    private readonly cookieService: CookieService,
  ) { }

  async register(
    createUserDto: CreateUserDto,
    file: MulterFileType,
    res: Response,
  ): Promise<any> {
    const { email } = createUserDto;
    const isExists = await this.userModel.exists({
      email: email,
    });
    if (isExists) {
      throw new BadRequestException(
        this.i18n.translate('exception.EMAIL_EXISTS'),
      );
    }

    let filePath = `/${process.env.UPLOADS_FOLDER}/users/avatar.png`;
    if (file) {
      try {
        filePath = await this.fileUploadService.saveFileToDisk(file, User.name);
      } catch (error) {
        this.logger.error('File upload failed', error);
        throw new InternalServerErrorException(
          this.i18n.translate('exception.ERROR_FILE_UPLOAD'),
        );
      }
    }
    createUserDto.avatar = filePath;
    createUserDto.role = roles.USER;
    const newUser = await this.userModel.create(createUserDto);

    const userId = {
      user_id: newUser._id.toString(),
      role: roles.USER.toLocaleLowerCase(),
      email: newUser.email,
    };

    newUser.avatar = `${process.env.BASE_URL}${filePath}`;
    const Tokens = await this.tokenService.generate_Tokens(userId);

    this.cookieService.setCookies(res, Tokens);

    const userWithTokens = {
      ...newUser.toObject(),
      access_token: Tokens.access_token,
      password: undefined,
      __v: undefined,
    };
    return userWithTokens;
  }

  async login(loginUserDto: LoginUserDto, res: Response): Promise<any> {
    const { email, password } = loginUserDto;
    const user = await this.userModel
      .findOne({ email })
      .select('password email role avatar name ')
      .lean()
      .exec();

    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.INVALID_LOGIN'),
      );
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new BadRequestException(
        this.i18n.translate('exception.INVALID_LOGIN'),
      );
    }

    const userId = {
      user_id: user._id.toString(),
      role: user.role || 'user',
      email: user.email,
    };
    const Tokens = await this.tokenService.generate_Tokens(userId);

    this.cookieService.setCookies(res, Tokens);

    const userResponse = {
      ...user,
      avatar: `${process.env.BASE_URL}${user.avatar}`,
      password: undefined,
      access_token: Tokens.access_token,
    };

    return userResponse;
  }

  async logout(
    req: { user: { user_id: string } },
    res: Response,
  ): Promise<{ message: string }> {
    if (!req.user) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_LOGGED'),
      );
    }
    try {
      await this.RefreshTokenModel.deleteOne({
        userId: req.user.user_id,
      });
      this.cookieService.clearCookies(res);
      return { message: this.i18n.translate('success.LOGOUT_SUCCESS') };
    } catch {
      throw new BadRequestException(
        this.i18n.translate('exception.ERROR_LOGOUT'),
      );
    }
  }
}
