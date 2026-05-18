import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { CreateUserDto } from './shared/dto/create-user.dto';
import { UpdateUserDto } from './shared/dto/update-user.dto';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { BaseService } from 'src/shared/utils/service/base.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User, UserDocument } from 'src/auth/shared/schema/user.schema';
import { UsersStatistics } from './users-helper/users-statistics.service';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { Role } from 'src/roles/shared/schemas/role.schema';

/**
 * Service responsible for managing user accounts, role assignments, profile updates, and statistics.
 * Extends `BaseService` to inherit standard CRUD operations with advanced file handling and i18n support.
 * Enforces strict hierarchical security checks to prevent privilege escalation.
 */
@Injectable()
export class UsersService extends BaseService<UserDocument> {
  protected slugSourceField = 'name';

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<Role>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
    protected readonly usersStatistics: UsersStatistics,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(userModel, i18n, fileUploadService);
  }

  /**
   * Retrieves user registration statistics aggregated over a specified date range.
   *
   * @param startDate - Optional ISO date string marking the beginning of the aggregation range.
   * @param endDate - Optional ISO date string marking the end of the aggregation range.
   * @returns An object containing statistical metrics regarding user growth and registration counts.
   */
  async getUsersStatistics(startDate?: string, endDate?: string) {
    return await this.usersStatistics.users_statistics(startDate, endDate);
  }

  /**
   * Creates a new user account in the system with optional avatar upload.
   * Enforces role hierarchy validation to ensure the creator cannot assign a role equal to or higher than their own level.
   *
   * @param createUserDto - Data transfer object containing the user's registration details.
   * @param file - Optional uploaded avatar image file.
   * @param currentUser - The currently authenticated user initiating the creation.
   * @returns The newly created user document.
   * @throws {ForbiddenException} If attempting to assign a role level at or above the creator's level.
   */
  async createUser(
    createUserDto: CreateUserDto,
    file: MulterFileType,
    currentUser: JwtPayload,
  ): Promise<any> {
    if (createUserDto.role) {
      await this.validateRoleAssignment(
        createUserDto.role,
        currentUser.level,
        'exception.user.CANNOT_CREATE_WITH_HIGHER_ROLE',
      );
    }

    return await this.createOneDoc(createUserDto, file, User.name, {
      fileFieldName: 'avatar',
      checkField: 'email',
      fieldValue: createUserDto.email,
      useDefaultFile: true,
    });
  }

  /**
   * Retrieves a paginated list of users matching the specified query criteria.
   * Automatically populates assigned role details (name and level).
   *
   * @param queryString - Parsed query parameters for filtering, sorting, and pagination.
   * @returns A paginated result object containing user documents and metadata.
   */
  async getUsers(queryString: QueryString): Promise<any> {
    return await this.findAllDoc(User.name, queryString, {
      path: 'role',
      select: 'name level',
    });
  }

  /**
   * Retrieves a single user document by its unique identifier.
   * Automatically populates assigned role details while excluding internal versioning fields (`__v`).
   *
   * @param idParamDto - Data transfer object containing the targeted user ID.
   * @returns The populated user document.
   * @throws {NotFoundException} If the user does not exist.
   */
  async findOne(idParamDto: IdParamDto) {
    return await this.findOneDoc(idParamDto, '-__v', false, {
      path: 'role',
      select: 'name level',
    });
  }

  /**
   * Updates an existing user's profile, role assignment, or avatar image.
   * Enforces strict hierarchy checks to ensure the caller cannot modify a user with an equal or higher role level,
   * nor assign a new role level equal to or higher than their own.
   * Automatically invalidates cached permissions and broadcasts real-time SSE updates upon role modification.
   *
   * @param idParamDto - Data transfer object containing the targeted user ID.
   * @param updateUserDto - Data transfer object containing the fields to update.
   * @param file - Optional newly uploaded avatar image file.
   * @param currentUser - The currently authenticated user performing the update.
   * @returns The updated user document.
   * @throws {NotFoundException} If the targeted user or role does not exist.
   * @throws {ForbiddenException} If attempting an unauthorized modification or role elevation.
   */
  async updateUser(
    idParamDto: IdParamDto,
    updateUserDto: UpdateUserDto,
    file: MulterFileType,
    currentUser: JwtPayload,
  ): Promise<any> {
    // 1. Validate modification authorization against the target user's current role level
    await this.validateTargetUserModification(
      idParamDto.id,
      currentUser.level,
      'exception.user.CANNOT_MODIFY_HIGHER_USER',
    );

    // 2. Validate authorization for the newly assigned role level (if applicable)
    if (updateUserDto.role) {
      await this.validateRoleAssignment(
        updateUserDto.role,
        currentUser.level,
        'exception.user.CANNOT_ASSIGN_HIGHER_ROLE',
      );
    }

    const selectedFields = '_id avatar email';
    const updatedUser = await this.updateOneDoc(
      idParamDto,
      updateUserDto,
      file,
      User.name,
      selectedFields,
      {
        checkField: 'email',
        fieldValue: updateUserDto.email,
        fileFieldName: 'avatar',
      },
    );

    // 3. Invalidate permission cache and broadcast real-time SSE permission refresh event upon role change
    if (updateUserDto.role) {
      await this.cacheManager.del(`user_permissions:${idParamDto.id}`);
      const newRole = await this.roleModel
        .findById(updateUserDto.role)
        .select('permissions')
        .lean();
      const permissions = newRole?.permissions || [];

      this.eventEmitter.emit(`user.notification.${idParamDto.id}`, {
        userId: idParamDto.id,
        action: 'REFRESH_PERMISSIONS',
        message:
          this.i18n.translate('notification.PERMISSIONS_UPDATED') ||
          'تم تحديث صلاحياتك من قبل الإدارة.',
        payload: { permissions },
      });
    }

    return updatedUser;
  }

  /**
   * Deletes a user account and its associated avatar from the system.
   * Enforces strict hierarchy checks to ensure the caller cannot delete a user with an equal or higher role level.
   * Automatically invalidates the deleted user's cached permissions.
   *
   * @param idParamDto - Data transfer object containing the targeted user ID.
   * @param currentUser - The currently authenticated user performing the deletion.
   * @throws {NotFoundException} If the targeted user does not exist.
   * @throws {ForbiddenException} If attempting to delete a user with an unauthorized role level.
   */
  async deleteUser(
    idParamDto: IdParamDto,
    currentUser: JwtPayload,
  ): Promise<void> {
    // 1. Validate deletion authorization against the target user's current role level
    await this.validateTargetUserModification(
      idParamDto.id,
      currentUser.level,
      'exception.user.CANNOT_DELETE_HIGHER_USER',
    );

    const deleteResult = await this.deleteOneDoc(idParamDto, 'avatar');

    // 2. Invalidate permission cache for the deleted user
    await this.cacheManager.del(`user_permissions:${idParamDto.id}`);

    return deleteResult;
  }

  // =========================================================================
  // Helper Methods (Private)
  // =========================================================================

  /**
   * Validates whether the currently authenticated user possesses sufficient authority
   * to assign a specific role. SuperAdmin (level 100) bypasses this restriction.
   *
   * @param roleId - The ID of the role being evaluated for assignment.
   * @param currentUserLevel - The hierarchy level of the currently authenticated user.
   * @param errorMessageKey - The i18n translation key to use if validation fails.
   * @throws {NotFoundException} If the specified role does not exist.
   * @throws {ForbiddenException} If attempting to assign a role at or above the user's own level.
   */
  private async validateRoleAssignment(
    roleId: string,
    currentUserLevel: number,
    errorMessageKey: string,
  ): Promise<void> {
    const role = await this.roleModel.findById(roleId);
    if (!role) {
      throw new NotFoundException(
        this.i18n.translate('exception.role.ROLE_NOT_FOUND'),
      );
    }
    if (role.level >= currentUserLevel && currentUserLevel !== 100) {
      throw new ForbiddenException(this.i18n.translate(errorMessageKey));
    }
  }

  /**
   * Validates whether the currently authenticated user possesses sufficient authority
   * to modify or delete a targeted user account based on comparative role levels.
   * SuperAdmin (level 100) bypasses this restriction.
   *
   * @param targetUserId - The ID of the user account being targeted for modification/deletion.
   * @param currentUserLevel - The hierarchy level of the currently authenticated user.
   * @param errorMessageKey - The i18n translation key to use if validation fails.
   * @throws {NotFoundException} If the targeted user account does not exist.
   * @throws {ForbiddenException} If attempting to modify/delete a user at or above the caller's own level.
   */
  private async validateTargetUserModification(
    targetUserId: string,
    currentUserLevel: number,
    errorMessageKey: string,
  ): Promise<void> {
    const targetUser = await this.userModel
      .findById(targetUserId)
      .populate('role')
      .lean()
      .exec();

    if (!targetUser) {
      throw new NotFoundException(
        this.i18n.translate('exception.USER_NOT_FOUND', {
          args: { variable: '' },
        }),
      );
    }

    const targetRoleLevel = (targetUser.role as Role)?.level || 0;
    if (targetRoleLevel >= currentUserLevel && currentUserLevel !== 100) {
      throw new ForbiddenException(this.i18n.translate(errorMessageKey));
    }
  }
}
