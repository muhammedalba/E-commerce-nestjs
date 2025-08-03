import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Request } from 'express';
import { Model } from 'mongoose';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { User } from '../schema/user.schema';
import { JwtPayload } from '../types/jwt-payload.interface';

interface SafeRequest extends Request {
  cookies: Record<string, string>;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectModel(User.name) private AuthModule: Model<User>,
    private readonly i18n: CustomI18nService,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    //1) Extract the request from the context
    const request = context.switchToHttp().getRequest<Request>();
    //2) Extract the token from the request header

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.NOT_LOGGED'),
      );
    }

    //3) Verify the token
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException(
        this.i18n.translate('exception.TOKEN_INVALID'),
      );
    }

    const tokenIssuedAt = payload.iat;
    //) get the user from the database
    const user = await this.AuthModule.findById(payload.user_id)
      .select('passwordChangeAt')
      .lean()
      .exec();
    if (!user) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.USER_NOT_FOUND', {
          args: { variable: payload.email },
        }),
      );
    }
    if (user.passwordChangeAt) {
      const passwordChangedAt = Math.floor(
        user.passwordChangeAt.getTime() / 1000,
      );
      // Check if the password was changed after the token was issued
      if (
        typeof tokenIssuedAt === 'number' &&
        tokenIssuedAt < passwordChangedAt
      ) {
        throw new UnauthorizedException(
          this.i18n.translate('exception.LOGIN_AGAIN'),
        );
      }
    }

    request['user'] = payload;

    return true;
  }

  // private extractTokenFromHeader(request: Request): string | undefined {
  //   const [type, token] = request.headers.authorization?.split(' ') ?? [];

  //   return type === 'Bearer' ? token : undefined;
  // }
  private extractTokenFromHeader(request: SafeRequest): string | undefined {
    const authHeader = request.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      console.log('------------Header access_token-------');
      console.log(token);
      console.log('------------Header access_token-------');
      if (token) return token;
    }

    const cookieToken = request.cookies['access_token'];
    console.log('--------------------cookieToken-----------------');
    console.log(cookieToken);
    console.log('--------------------cookieToken-----------------');

    if (cookieToken) return cookieToken;

    return undefined;
  }
}
