import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../../auth/shared/schema/user.schema';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { Permissions } from '../enums/permissions.enum';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';


/**
 * Guard that handles Permission-Based Access Control (PBAC).
 * It checks if the current user has all the required permissions defined in the @RequirePermission decorator.
 * Supports bypassing for SuperAdmin (level 100).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly i18n: CustomI18nService,
  ) { }

  /**
   * Main authorization logic.
   * 1. Extracts required permissions from metadata.
   * 2. Checks user authentication.
   * 3. Bypasses for SuperAdmin.
   * 4. Fetches and caches user permissions.
   * 5. Validates against required permissions.
   * @param context ExecutionContext from NestJS
   * @returns boolean | Promise<boolean>
   * @throws ForbiddenException if user is not authorized or lacks permissions
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permissions[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no specific permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const userPayload = request.user; // Comes from JwtAuthGuard

    if (!userPayload) {
      throw new ForbiddenException(this.i18n.translate('exception.NOT_AUTHORIZED'));
    }

    // Level 100 is SuperAdmin - always passes
    if (userPayload.level === 100) return true;

    const cacheKey = `user_permissions:${userPayload.user_id}`;
    let userPermissions = await this.cacheManager.get<Permissions[]>(cacheKey);

    if (!userPermissions) {

      // Fetch user from DB and populate role with only permissions field
      const user: any = await this.userModel
        .findById(userPayload.user_id)
        .select('_id role')
        .populate('role', 'permissions')
        .lean();

      userPermissions = user && user.role && Array.isArray(user.role.permissions) ? user.role.permissions : [];

      // Cache the permissions for 12 hours (12 * 60 * 60 * 1000)
      await this.cacheManager.set(cacheKey, userPermissions, 1000 * 60 * 60 * 12);
    }

    // MUST HAVE ALL required permissions (.every)
    const hasAllPermissions = requiredPermissions.every((requiredPerm) =>
      userPermissions?.includes(requiredPerm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(this.i18n.translate('exception.FORBIDDEN_PERMISSIONS'));
    }

    return true;
  }
}
