import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Request } from 'express';
import { Model, Types } from 'mongoose';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { User } from '../schema/user.schema';
import { JwtPayload } from '../types/jwt-payload.interface';

interface SafeRequest extends Omit<Request, 'user'> {
  cookies: Record<string, string>;
  user?: JwtPayload;
}

/**
 * Authenticates HTTP requests using a signed JWT access token.
 *
 * @description The guard accepts the token from either the `Authorization: Bearer`
 * header or the `access_token` cookie. After signature/expiry verification, it
 * loads the user record to enforce account status and password-change invalidation.
 *
 * @security
 * - Client-provided user identity is never trusted; `request.user` is assigned only
 *   after JWT verification succeeds.
 * - `passwordChangeAt` invalidates tokens issued before a password change.
 * - Blocked or deleted users are rejected even if they still hold an unexpired JWT.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectModel(User.name) private AuthModule: Model<User>,
    private readonly i18n: CustomI18nService,
    private jwtService: JwtService,
  ) {}

  /**
   * Validates the request token and attaches the verified JWT payload.
   *
   * @description Checks for a token, verifies it with `JwtService`, fetches the
   * user by `payload.user_id`, rejects inactive/deleted users, and rejects tokens
   * issued before the user's latest password change.
   *
   * @param context - Nest execution context for the current HTTP request.
   * @returns `true` when authentication succeeds and `request.user` is populated.
   * @throws {UnauthorizedException} If the token is missing, invalid, stale, or the user is absent.
   * @throws {BadRequestException} If the authenticated account is blocked.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    //1) Extract the request from the context
    const request = context.switchToHttp().getRequest<SafeRequest>();
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
      .select('passwordChangeAt isActive role')
      .lean()
      .exec();
    if (!user) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.USER_NOT_FOUND', {
          args: { variable: payload.email },
        }),
      );
    }
    if (!user.isActive) {
      throw new BadRequestException(
        this.i18n.translate('exception.ACCOUNT_BLOCKED'),
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

    let roleId: string | undefined;
    if (user.role) {
      if (user.role instanceof Types.ObjectId) {
        roleId = user.role.toHexString();
      } else if (typeof user.role === 'string') {
        roleId = user.role;
      } else if (typeof user.role === 'object' && '_id' in user.role) {
        const roleObj = user.role as { _id: Types.ObjectId | string };
        roleId =
          roleObj._id instanceof Types.ObjectId
            ? roleObj._id.toHexString()
            : String(roleObj._id);
      }
    }

    request.user = {
      ...payload,
      roleId,
    };

    return true;
  }

  /**
   * Extracts an access token from the supported request locations.
   *
   * @description Header tokens take precedence over cookies so API clients can
   * explicitly authenticate without relying on browser cookie state.
   *
   * @param request - Request carrying headers and parsed cookies.
   * @returns The raw JWT string when present, otherwise `undefined`.
   */
  private extractTokenFromHeader(request: SafeRequest): string | undefined {
    const authHeader = request.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) return token;
    }
    const cookieToken = request.cookies['access_token'];
    if (cookieToken) return cookieToken;

    return undefined;
  }
}
