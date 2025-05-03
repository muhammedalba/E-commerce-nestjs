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
import { User } from 'src/users/shared/schemas/user.schema';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
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
    let payload: { user_id: string; email: string; role: string; iat: number };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException(
        this.i18n.translate('exception.INVALID', {
          args: { variable: 'token' },
        }),
      );
    }

    const tokenIssuedAt = payload.iat;
    //) get the user from the database
    const user = await this.userModel
      .findById(payload.user_id)
      .select('passwordChangeAt')
      .lean();
    if (!user) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.INVALID', {
          args: { variable: 'token' },
        }),
      );
    }
    if (user.passwordChangeAt) {
      const passwordChangedAt = Math.floor(
        user.passwordChangeAt.getTime() / 1000,
      );
      // Check if the password was changed after the token was issued
      if (tokenIssuedAt < passwordChangedAt) {
        throw new UnauthorizedException(
          this.i18n.translate('exception.LOGIN_AGAIN'),
        );
      }
    }

    request['user'] = payload;

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
