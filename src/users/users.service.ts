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
import { User, UserDocument } from 'src/auth/shared/schema/user.schema';
import { UsersStatistics } from './users-helper/users-statistics.service';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { Role } from 'src/roles/shared/schemas/role.schema';

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
  ) {
    super(userModel, i18n, fileUploadService);
  }

  async getUsersStatistics(startDate?: string, endDate?: string) {
    return await this.usersStatistics.users_statistics(startDate, endDate);
  }

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

  async getUsers(queryString: QueryString): Promise<any> {
    return await this.findAllDoc(User.name, queryString, {
      path: 'role',
      select: 'name level',
    });
  }

  async findOne(idParamDto: IdParamDto) {
    return await this.findOneDoc(idParamDto, '-__v', false, {
      path: 'role',
      select: 'name level',
    });
  }

  async updateUser(
    idParamDto: IdParamDto,
    updateUserDto: UpdateUserDto,
    file: MulterFileType,
    currentUser: JwtPayload,
  ): Promise<any> {
    // 1. التحقق من صلاحية تعديل المستخدم المستهدف
    await this.validateTargetUserModification(
      idParamDto.id,
      currentUser.level,
      'exception.user.CANNOT_MODIFY_HIGHER_USER',
    );

    // 2. التحقق من صلاحية تعيين الدور الجديد (إن وجد)
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

    // 3. تفريغ كاش الصلاحيات في حال تم تغيير الدور
    if (updateUserDto.role) {
      await this.cacheManager.del(`user_permissions:${idParamDto.id}`);
    }

    return updatedUser;
  }

  async deleteUser(
    idParamDto: IdParamDto,
    currentUser: JwtPayload,
  ): Promise<void> {
    // 1. التحقق من صلاحية حذف المستخدم المستهدف
    await this.validateTargetUserModification(
      idParamDto.id,
      currentUser.level,
      'exception.user.CANNOT_DELETE_HIGHER_USER',
    );

    const deleteResult = await this.deleteOneDoc(idParamDto, 'avatar');

    // 2. تفريغ كاش الصلاحيات للمستخدم المحذوف
    await this.cacheManager.del(`user_permissions:${idParamDto.id}`);

    return deleteResult;
  }

  // =========================================================================
  // Helper Methods (Private)
  // =========================================================================

  /**
   * للتحقق مما إذا كان المستخدم الحالي يملك الصلاحية لتعيين هذا الدور المعين
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
   * للتحقق مما إذا كان المستخدم الحالي يملك الصلاحية لتعديل/حذف المستخدم المستهدف
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
