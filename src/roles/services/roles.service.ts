import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Role, RoleDocument } from '../shared/schemas/role.schema';
import { User } from '../../auth/shared/schema/user.schema';
import {
  Permissions,
  PERMISSIONS_METADATA,
} from '../shared/enums/permissions.enum';
import { JwtPayload } from '../../auth/shared/types/jwt-payload.interface';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { CreateRoleDto, UpdateRoleDto } from '../shared/dto/role.dto';

/**
 * Service responsible for managing Roles and Permissions within the system.
 * Handles hierarchy validation, system role protection, caching invalidation,
 * and high-performance aggregations.
 */
@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly i18n: CustomI18nService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Validates the role hierarchy and enforces system-defined role protections.
   * Allows SuperAdmin (level 100) to bypass certain update restrictions while
   * strictly protecting system roles from deletion and peer modification.
   *
   * @param targetRole - The role document being targeted for modification or deletion.
   * @param currentUser - The currently authenticated user performing the action.
   * @param action - The type of action being performed ('update' or 'delete').
   * @throws {ForbiddenException} If the user attempts an unauthorized modification or deletion.
   */
  private checkHierarchyAndSystemProtection(
    targetRole: RoleDocument,
    currentUser: JwtPayload,
    action: 'update' | 'delete',
  ) {
    const isSuperAdmin = currentUser.level === 100;

    // 1. Absolute prohibition of deleting system-defined roles (even SuperAdmin cannot delete core roles)
    if (action === 'delete' && targetRole.isSystemDefined) {
      throw new ForbiddenException(
        this.i18n.translate('exception.role.SYSTEM_ROLE_CANNOT_BE_DELETED'),
      );
    }

    // 2. Allow SuperAdmin to update system-defined roles (including their own role)
    if (isSuperAdmin && action === 'update') {
      return;
    }

    // 3. Strict rules for standard administrators and staff
    if (targetRole.isSystemDefined) {
      throw new ForbiddenException(
        this.i18n.translate('exception.role.SYSTEM_ROLE_PROTECTED'),
      );
    }

    // Prevent modifying a role with a level higher than or equal to the current user's level (prevents peer promotion)
    if (targetRole.level >= currentUser.level) {
      throw new ForbiddenException(
        this.i18n.translate('exception.role.CANNOT_MODIFY_HIGHER_ROLE'),
      );
    }
  }

  /**
   * Helper method to invalidate user permissions cache in parallel for maximum performance.
   * Executed whenever a role's permissions are modified or when a role is deleted.
   *
   * @param roleId - The ID of the role whose assigned users' cache needs invalidation.
   * @param action - Optional SSE action to broadcast to affected users.
   */
  private async invalidateUsersCache(
    roleId: string | Types.ObjectId,
    action?: 'FORCE_LOGOUT' | 'REFRESH_PERMISSIONS',
    prefetchedUsers?: { _id: Types.ObjectId | string }[],
  ) {
    const affectedUsers =
      prefetchedUsers ||
      (await this.userModel.find({ role: roleId }).select('_id').lean());

    if (affectedUsers.length > 0) {
      const roleDoc = await this.roleModel
        .findById(roleId)
        .select('permissions')
        .lean();
      const permissions = roleDoc?.permissions || [];
      // to make it case insensitive
      const CHUNK_SIZE = 500;
      for (let i = 0; i < affectedUsers.length; i += CHUNK_SIZE) {
        const chunk = affectedUsers.slice(i, i + CHUNK_SIZE);
        const cachePromises = chunk.map((user) =>
          this.cacheManager.del(`user_permissions:${user._id.toString()}`),
        );
        await Promise.all(cachePromises);
        // to make it case insensitive
        if (action) {
          chunk.forEach((user) => {
            const userIdStr = user._id.toString();
            // send notification to user
            this.eventEmitter.emit(`user.notification.${userIdStr}`, {
              userId: userIdStr,
              action,
              message:
                action === 'FORCE_LOGOUT'
                  ? this.i18n.translateAll('notification.FORCE_LOGOUT')
                  : this.i18n.translateAll('notification.PERMISSIONS_UPDATED'),
              payload: { permissions },
            });
          });
        }
      }
    }
  }

  /**
   * Creates a new custom role in the system.
   * Enforces hierarchy checks to ensure a user cannot create a role with a level higher than or equal to their own.
   *
   * @param createRoleDto - Data transfer object containing the role details.
   * @param currentUser - The currently authenticated user performing the creation.
   * @returns The newly created role document.
   * @throws {ForbiddenException} If attempting to create a role at or above the user's own level.
   */
  async createRole(createRoleDto: CreateRoleDto, currentUser: JwtPayload) {
    if (createRoleDto.level >= currentUser.level) {
      throw new ForbiddenException(
        this.i18n.translate('exception.role.CANNOT_CREATE_HIGHER_ROLE'),
      );
    }

    if (createRoleDto.permissions) {
      const permissionsSet = new Set(createRoleDto.permissions);
      if (permissionsSet.has(Permissions.UPDATE_SETTINGS)) {
        permissionsSet.add(Permissions.VIEW_SETTINGS);
      }
      createRoleDto.permissions = Array.from(permissionsSet);
    }

    return this.roleModel.create(createRoleDto);
  }

  /**
   * Updates an existing role's details or permissions.
   * Enforces hierarchy validation, prevents peer elevation, and protects SuperAdmin from accidental self-lockout.
   *
   * @param roleId - The ID of the role to update.
   * @param updateRoleDto - Data transfer object containing the fields to update.
   * @param currentUser - The currently authenticated user performing the update.
   * @returns The updated role document.
   * @throws {NotFoundException} If the targeted role does not exist.
   * @throws {ForbiddenException} If hierarchy rules or SuperAdmin protections are violated.
   */
  async updateRole(
    roleId: string,
    updateRoleDto: UpdateRoleDto,
    currentUser: JwtPayload,
  ) {
    const targetRole = await this.roleModel.findById(roleId);
    if (!targetRole)
      throw new NotFoundException(
        this.i18n.translate('exception.role.ROLE_NOT_FOUND'),
      );

    this.checkHierarchyAndSystemProtection(targetRole, currentUser, 'update');

    // Prevent any user (including SuperAdmin) from elevating a role's level to be equal to or higher than their own
    if (updateRoleDto.level && updateRoleDto.level > currentUser.level) {
      throw new ForbiddenException(
        this.i18n.translate('exception.role.CANNOT_RAISE_LEVEL'),
      );
    }

    // Additional protection: prevent SuperAdmin from accidentally downgrading the core SuperAdmin role level below 100
    if (
      targetRole.level === 100 &&
      updateRoleDto.level !== undefined &&
      updateRoleDto.level < 100
    ) {
      throw new ForbiddenException(
        this.i18n.translate('exception.role.SUPERADMIN_LEVEL_PROTECTED'),
      );
    }

    if (updateRoleDto.permissions) {
      const permissionsSet = new Set(updateRoleDto.permissions);
      if (permissionsSet.has(Permissions.UPDATE_SETTINGS)) {
        permissionsSet.add(Permissions.VIEW_SETTINGS);
      }
      updateRoleDto.permissions = Array.from(permissionsSet);
    }

    Object.assign(targetRole, updateRoleDto);
    const updatedRole = await targetRole.save();

    if (updateRoleDto.permissions) {
      await this.invalidateUsersCache(roleId, 'REFRESH_PERMISSIONS');
    }

    return updatedRole;
  }

  /**
   * Deletes a custom role from the system.
   * Reassigns all associated users to the default 'User' role and invalidates their permission caches.
   * System-defined roles are strictly protected from deletion.
   *
   * @param roleId - The ID of the role to delete.
   * @param currentUser - The currently authenticated user performing the deletion.
   * @returns A success message object upon completion.
   * @throws {NotFoundException} If the targeted role does not exist.
   * @throws {ForbiddenException} If attempting to delete a system-defined role.
   * @throws {InternalServerErrorException} If the default 'User' role cannot be found in the database.
   */
  async deleteRole(roleId: string, currentUser: JwtPayload) {
    const targetRole = await this.roleModel.findById(roleId);
    if (!targetRole)
      throw new NotFoundException(
        this.i18n.translate('exception.role.ROLE_NOT_FOUND'),
      );

    this.checkHierarchyAndSystemProtection(targetRole, currentUser, 'delete');

    const defaultRole = await this.roleModel.findOne({ name: 'User' }).lean();
    if (!defaultRole) {
      throw new InternalServerErrorException(
        this.i18n.translate('exception.role.DEFAULT_ROLE_MISSING'),
      );
    }

    // 1. Prefetch affected users before modifying the database
    const affectedUsers = await this.userModel
      .find({ role: roleId })
      .select('_id')
      .lean();

    // 2. Execute DB operations inside a MongoDB Transaction to ensure ACID compliance
    const session = await this.roleModel.db.startSession();
    session.startTransaction();
    try {
      // Reassign users to the default role within the transaction session
      await this.userModel.updateMany(
        { role: roleId },
        { $set: { role: defaultRole._id } },
        { session },
      );

      // Delete the role within the transaction session
      await this.roleModel.findByIdAndDelete(roleId, { session });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

    // 3. Invalidate cache and emit real-time logout events ONLY after successful transaction commit
    await this.invalidateUsersCache(roleId, 'FORCE_LOGOUT', affectedUsers);

    return { message: this.i18n.translate('exception.role.SUCCESS_DELETE') };
  }

  /**
   * Retrieves all roles in the system along with their assigned user count.
   * Utilizes MongoDB Aggregation pipeline for high-performance execution instead of N+1 queries.
   *
   * @returns An array of role aggregation objects sorted by level in descending order.
   */
  async getAllRoles(): Promise<any[]> {
    return this.roleModel.aggregate([
      {
        $match: { level: { $lt: 100 } }, // Prevent sending SuperAdmin (level 100) to the frontend
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'role',
          as: 'assignedUsers',
        },
      },
      {
        $addFields: {
          userCount: { $size: '$assignedUsers' },
        },
      },
      {
        $project: {
          assignedUsers: 0, // Exclude user array to minimize response payload size
        },
      },
      {
        $sort: { level: -1 },
      },
    ]);
  }

  /**
   * Retrieves all system permissions grouped by their respective categories.
   * Formats the metadata into a structured array suitable for UI checkbox grids.
   *
   * @returns An array of grouped permission objects containing group names and permission key-label pairs.
   */
  getGroupedPermissions(): any[] {
    const groupsMap = PERMISSIONS_METADATA.reduce(
      (acc, meta) => {
        // ترجمة اسم المجموعة ديناميكياً بناءً على لغة الطلب الحالية
        const groupName = this.i18n.translate(meta.groupKey);
        // ترجمة اسم الصلاحية ديناميكياً بناءً على لغة الطلب الحالية
        const label = this.i18n.translate(meta.labelKey);

        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push({ key: meta.key, label });
        return acc;
      },
      {} as Record<string, { key: string; label: string }[]>,
    );

    return Object.entries(groupsMap).map(([group, permissions]) => ({
      group,
      permissions,
    }));
  }

  /**
   * Retrieves the assigned permissions for a specific user.
   * Utilizes caching to minimize database query overhead for repeated permission checks.
   *
   * @param userId - The ID of the user whose permissions are being retrieved.
   * @returns An array of permission string keys assigned to the user.
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = `user_permissions:${userId}`;
    let userPermissions = await this.cacheManager.get<string[]>(cacheKey);

    if (!userPermissions) {
      const user = await this.userModel
        .findById(userId)
        .select('role')
        .populate<{ role: RoleDocument }>('role', 'permissions')
        .lean();

      const permissionsSet = new Set(user?.role?.permissions || []);
      if (permissionsSet.has(Permissions.UPDATE_SETTINGS)) {
        permissionsSet.add(Permissions.VIEW_SETTINGS);
      }
      userPermissions = Array.from(permissionsSet);

      await this.cacheManager.set(
        cacheKey,
        userPermissions,
        1000 * 60 * 60 * 12, // 12 Hours
      );
    }

    return userPermissions;
  }
}
