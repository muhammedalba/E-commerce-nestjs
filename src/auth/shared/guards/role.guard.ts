import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { roles } from 'src/auth/shared/enums/role.enum';
import { Roles_key } from '../decorators/rolesdecorator';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { JwtPayload } from '../types/jwt-payload.interface';
import { User } from '../schema/user.schema';

// add this to your request object in middleware or guards
interface CustomRequest extends Request {
  user?: JwtPayload & Partial<User>;
}

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly i18n: CustomI18nService,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    // Extract the user info from request
    const user = context.switchToHttp().getRequest<CustomRequest>().user;
    if (!user) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.NOT_LOGGED'),
      );
    }
    // get required roles from method or class decorators
    const requiredRoles = this.reflector.getAllAndOverride<roles[]>(Roles_key, [
      context.getHandler(),
      context.getClass(),
    ]);
    // check if user has required role  or admin role  (for example)
    const hasRequiredRole: boolean = requiredRoles.some(
      (role) => user?.role.toString() === role.toString(),
    );

    if (!hasRequiredRole) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.NOT_AUTHORIZED'),
      );
    }
    // if user has required role or admin role, return true to allow access
    return hasRequiredRole;
  }
}
