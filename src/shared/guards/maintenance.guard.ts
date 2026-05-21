import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import { SettingsService } from 'src/settings/settings.service';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/auth/shared/schema/user.schema';
import { Request } from 'express';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';

/**
 * Guard responsible for enforcing system maintenance mode access control.
 * Intercepts incoming HTTP requests to determine if maintenance mode is active.
 * Bypasses authentication routes and permits access exclusively to SuperAdmins
 * (level 100) or administrators possessing explicit settings management permissions
 * (UPDATE_SETTINGS and VIEW_SETTINGS). Utilizes multi-layered caching for optimal performance.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly jwtService: JwtService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  /**
   * Evaluates whether the current request is permitted to proceed.
   * Checks global settings for maintenance mode, allows essential authentication routes,
   * verifies JWT credentials, and validates explicit user permissions.
   *
   * @param context - The execution context of the current request.
   * @returns A boolean indicating whether access is granted.
   * @throws {ServiceUnavailableException} If maintenance mode is active and the user lacks required permissions.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const settings = await this.settingsService.getSettings();
    const isMaintenance = settings.maintenanceMode ?? false;

    // 1. Early return if maintenance mode is inactive
    if (!isMaintenance) return true;

    const request = context.switchToHttp().getRequest<Request>();

    // 2. Allow essential authentication routes to enable administrative login
    if (this.isAuthRoute(request.url)) return true;

    // 3. Extract access token and verify user authorization
    const token = this.extractTokenFromHeader(request);
    if (token) {
      const hasAccess = await this.verifyUserAccess(token);
      if (hasAccess) return true;
    }

    // 4. Deny access with a localized 503 Service Unavailable exception
    this.throwMaintenanceException(request, settings);
  }

  /**
   * Determines if the requested URL corresponds to an authentication endpoint.
   * Ensures administrators can authenticate even during active maintenance windows.
   *
   * @param url - The target request URL.
   * @returns True if the route is an authentication endpoint.
   */
  private isAuthRoute(url: string): boolean {
    return (
      url.includes('/auth/login') ||
      url.includes('/auth/verify-Pass-Reset-Code') ||
      url.includes('/settings/clear-cache') ||
      url.includes('/settings')
    );
  }

  /**
   * Verifies user credentials and evaluates access permissions against maintenance restrictions.
   * Automatically grants access to SuperAdmins (level 100). For standard administrators,
   * enforces the presence of both UPDATE_SETTINGS and VIEW_SETTINGS permissions using O(1) Set lookups.
   *
   * @param token - The raw JWT access token.
   * @returns A promise resolving to true if authorized, false otherwise.
   */
  private async verifyUserAccess(token: string): Promise<boolean> {
    try {
      const userPayload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (!userPayload) return false;
      if (userPayload.level === 100) return true; // SuperAdmin bypass

      // Retrieve user permissions from cache or database
      const permissionsArray = await this.getUserPermissions(
        userPayload.user_id,
      );

      // Convert permissions array to Set for O(1) high-performance lookup
      const userPermissionsSet = new Set(permissionsArray);

      const requiredPermissions = [
        Permissions.UPDATE_SETTINGS,
        Permissions.VIEW_SETTINGS,
        Permissions.ACCESS_DASHBOARD,
      ];

      // Validate that all required permissions are possessed by the user
      return requiredPermissions.every((permission) =>
        userPermissionsSet.has(permission),
      );
    } catch {
      // Gracefully handle token expiration or verification failures by denying access
      return false;
    }
  }

  /**
   * Retrieves user permissions from the distributed cache or MongoDB database.
   * Implements permission dependency injection by automatically appending VIEW_SETTINGS
   * if UPDATE_SETTINGS is present. Caches the resolved permissions for 12 hours.
   *
   * @param userId - The unique identifier of the user.
   * @returns An array of assigned permission enums.
   */
  private async getUserPermissions(userId: string): Promise<Permissions[]> {
    const cacheKey = `user_permissions:${userId}`;

    // 1. Attempt retrieval from cache first
    const cachedPermissions =
      await this.cacheManager.get<Permissions[]>(cacheKey);
    if (cachedPermissions) {
      return cachedPermissions;
    }

    // 2. Fetch role and permissions from database if cache miss occurs
    const user = (await this.userModel
      .findById(userId)
      .select('role')
      .populate('role', 'permissions')
      .lean()) as { role?: { permissions?: Permissions[] } } | null;

    const fetchedPermissions: Permissions[] =
      user?.role?.permissions && Array.isArray(user.role.permissions)
        ? user.role.permissions
        : [];

    // 3. Convert to Set to ensure uniqueness and facilitate dependency injection
    const permissionsSet = new Set(fetchedPermissions);

    // Enforce permission dependency: automatically include VIEW_SETTINGS if UPDATE_SETTINGS exists
    if (permissionsSet.has(Permissions.UPDATE_SETTINGS)) {
      permissionsSet.add(Permissions.VIEW_SETTINGS);
    }

    // 4. Convert Set back to Array for optimal JSON serialization in cache storage
    const finalPermissions = Array.from(permissionsSet);

    // Store resolved permissions in cache with a 12-hour TTL (43,200,000 ms)
    await this.cacheManager.set(
      cacheKey,
      finalPermissions,
      1000 * 60 * 60 * 12,
    );

    return finalPermissions;
  }

  /**
   * Throws a localized Service Unavailable Exception (HTTP 503) based on request headers.
   * Dynamically extracts the appropriate maintenance message according to the 'x-lang' header.
   *
   * @param request - The incoming Express request object.
   * @param settings - The application settings containing localized maintenance messages.
   * @throws {ServiceUnavailableException} Always thrown to terminate request processing.
   */
  private throwMaintenanceException(
    request: Request,
    settings: { maintenanceMessage?: unknown },
  ): never {
    const lang = (request.headers['x-lang'] as string) || 'ar';
    const maintenanceMessages = (settings.maintenanceMessage ||
      {}) as unknown as Record<string, string>;
    const message = maintenanceMessages[lang] || 'الموقع قيد الصيانة حالياً';

    throw new ServiceUnavailableException(message);
  }

  /**
   * Extracts the JWT access token from the HTTP Authorization header or Request Cookies.
   * Supports standard Bearer tokens as well as secure cookie-based authentication sessions.
   *
   * @param request - The incoming Express request object.
   * @returns The extracted JWT token string, or undefined if not found.
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) return token;
    }

    // Safely extract cookies without interfering with Express Request typing
    const reqWithCookies = request as unknown as {
      cookies?: Record<string, string>;
    };
    return reqWithCookies.cookies?.['access_token'];
  }
}
