import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
    protected readonly usersStatistics: UsersStatistics,
  ) {
    super(userModel, i18n, fileUploadService);
  }
  async get_users_statistics(startDate?: string, endDate?: string) {
    return await this.usersStatistics.users_statistics(startDate, endDate);
  }
  async createUser(
    CreateUserDto: CreateUserDto,
    file: MulterFileType,
    currentUser: JwtPayload,
  ): Promise<any> {
    if (CreateUserDto.role) {
      const newRole = await this.roleModel.findById(CreateUserDto.role);
      if (!newRole) throw new NotFoundException('الدور غير موجود');
      if (newRole.level >= currentUser.level && currentUser.level !== 100) {
        throw new ForbiddenException(
          'لا يمكنك إنشاء مستخدم بدور يمتلك صلاحيات مساوية أو أعلى من صلاحياتك',
        );
      }
    }

    return await this.createOneDoc(CreateUserDto, file, User.name, {
      fileFieldName: 'avatar',
      checkField: 'email',
      fieldValue: CreateUserDto.email,
      useDefaultFile: true,
    });
  }
  async getUsers(QueryString: QueryString): Promise<any> {
    return await this.findAllDoc(User.name, QueryString, {
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

  async update_user(
    idParamDto: IdParamDto,
    UpdateUserDto: UpdateUserDto,
    file: MulterFileType,
    currentUser: JwtPayload,
  ): Promise<any> {
    const targetUser = await this.userModel
      .findById(idParamDto.id)
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

    const targetRoleLevel = (targetUser.role as any)?.level || 0;

    // Check existing user's role level
    if (targetRoleLevel >= currentUser.level && currentUser.level !== 100) {
      throw new ForbiddenException(
        'لا يمكنك تعديل مستخدم يمتلك صلاحيات مساوية أو أعلى من صلاحياتك',
      );
    }

    // Check new role if it's being updated
    if (UpdateUserDto.role) {
      const newRole = await this.roleModel.findById(UpdateUserDto.role);
      if (!newRole) throw new NotFoundException('الدور غير موجود');
      if (newRole.level >= currentUser.level && currentUser.level !== 100) {
        throw new ForbiddenException(
          'لا يمكنك تعيين دور يمتلك صلاحيات مساوية أو أعلى من صلاحياتك',
        );
      }
    }

    const selectedFields = '_id avatar email';
    return await this.updateOneDoc(
      idParamDto,
      UpdateUserDto,
      file,
      User.name,
      selectedFields,
      {
        checkField: 'email',
        fieldValue: UpdateUserDto.email,
        fileFieldName: 'avatar',
      },
    );
  }

  async delete_user(
    idParamDto: IdParamDto,
    currentUser: JwtPayload,
  ): Promise<void> {
    const targetUser = await this.userModel
      .findById(idParamDto.id)
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

    const targetRoleLevel = (targetUser.role as any)?.level || 0;

    // Check existing user's role level
    if (targetRoleLevel >= currentUser.level && currentUser.level !== 100) {
      throw new ForbiddenException(
        'لا يمكنك حذف مستخدم يمتلك صلاحيات مساوية أو أعلى من صلاحياتك',
      );
    }

    return await this.deleteOneDoc(idParamDto, 'avatar');
  }
}
