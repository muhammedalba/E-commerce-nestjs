import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
  InternalServerErrorException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { Role, RoleDocument } from '../shared/schemas/role.schema';
import { User } from '../../auth/shared/schema/user.schema';
import { Permissions, PERMISSIONS_METADATA } from '../shared/enums/permissions.enum';
import { JwtPayload } from '../../auth/shared/types/jwt-payload.interface';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

// يُفضل تعريف هذه الـ Interfaces في ملفات DTO منفصلة
interface CreateRoleDto {
  name: string;
  level: number;
  permissions?: string[];
  [key: string]: any;
}

interface UpdateRoleDto extends Partial<CreateRoleDto> { }

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly i18n: CustomI18nService,
  ) { }

  /**
     * دالة التحقق من التسلسل الهرمي مع دعم الاستثناء للـ SuperAdmin
     */
  private checkHierarchyAndSystemProtection(
    targetRole: RoleDocument,
    currentUser: JwtPayload,
    action: 'update' | 'delete'
  ) {
    const isSuperAdmin = currentUser.level === 100; // بافتراض أن 100 هو أعلى مستوى

    // 1. المنع المطلق لحذف الأدوار النظامية (حتى السوبر آدمن لا يمكنه حذف دوره)
    if (action === 'delete' && targetRole.isSystemDefined) {
      throw new ForbiddenException(this.i18n.translate('exception.role.SYSTEM_ROLE_CANNOT_BE_DELETED'));
    }

    // 2. السماح للسوبر آدمن بتعديل الأدوار النظامية (بما فيها دوره)
    if (isSuperAdmin && action === 'update') {
      return; // تجاوز الحماية والسماح له بالمرور
    }

    // 3. القواعد الصارمة لباقي المدراء والموظفين
    if (targetRole.isSystemDefined) {
      throw new ForbiddenException(this.i18n.translate('exception.role.SYSTEM_ROLE_PROTECTED'));
    }

    // يمنع تعديل دور أعلى أو مساوٍ لمستوى المستخدم الحالي (يمنع ترقية الأقران)
    if (targetRole.level >= currentUser.level) {
      throw new ForbiddenException(this.i18n.translate('exception.role.CANNOT_MODIFY_HIGHER_ROLE'));
    }
  }

  /**
   * دالة مساعدة لمسح الكاش بشكل متوازي (Parallel) لتحسين الأداء
   */
  private async invalidateUsersCache(roleId: string | Types.ObjectId) {
    const affectedUsers = await this.userModel.find({ role: roleId }).select('_id').lean();

    if (affectedUsers.length > 0) {
      // استخدام Promise.all لمنع حظر الـ Event Loop بدلاً من for..of
      const cachePromises = affectedUsers.map((user) =>
        this.cacheManager.del(`user_permissions:${user._id.toString()}`)
      );
      await Promise.all(cachePromises);
    }
  }

  async createRole(createRoleDto: CreateRoleDto, currentUser: JwtPayload) {
    if (createRoleDto.level >= currentUser.level) {
      throw new ForbiddenException(this.i18n.translate('exception.role.CANNOT_CREATE_HIGHER_ROLE'));
    }
    return this.roleModel.create(createRoleDto);
  }

  async updateRole(roleId: string, updateRoleDto: UpdateRoleDto, currentUser: JwtPayload) {
    const targetRole = await this.roleModel.findById(roleId);
    if (!targetRole) throw new NotFoundException(this.i18n.translate('exception.role.ROLE_NOT_FOUND'));

    // نمرر نوع العملية 'update'
    this.checkHierarchyAndSystemProtection(targetRole, currentUser, 'update');

    // منع أي شخص (حتى السوبر آدمن) من رفع مستوى دور ليصبح مساوياً أو أعلى منه
    if (updateRoleDto.level && updateRoleDto.level > currentUser.level) {
      throw new ForbiddenException(this.i18n.translate('exception.role.CANNOT_RAISE_LEVEL'));
    }

    // حماية إضافية: منع السوبر آدمن من تخفيض مستوى دوره النظامي بالخطأ
    if (targetRole.isSystemDefined && updateRoleDto.level !== undefined && updateRoleDto.level < 100) {
      throw new ForbiddenException('لا يمكن تخفيض مستوى دور النظام الأساسي');
    }

    Object.assign(targetRole, updateRoleDto);
    const updatedRole = await targetRole.save();

    if (updateRoleDto.permissions) {
      await this.invalidateUsersCache(roleId);
    }
     

    return updatedRole;
  }

  async deleteRole(roleId: string, currentUser: JwtPayload) {
    const targetRole = await this.roleModel.findById(roleId);
    if (!targetRole) throw new NotFoundException(this.i18n.translate('exception.role.ROLE_NOT_FOUND'));

    // نمرر نوع العملية 'delete'
    // هذه الدالة سترفض العملية فوراً إذا كان الدور isSystemDefined
    this.checkHierarchyAndSystemProtection(targetRole, currentUser, 'delete');

    const defaultRole = await this.roleModel.findOne({ name: 'User' }).lean();
    if (!defaultRole) {
      throw new InternalServerErrorException(this.i18n.translate('exception.role.DEFAULT_ROLE_MISSING'));
    }

    // نقل المستخدمين إلى الدور الافتراضي ومسح الكاش
    await this.userModel.updateMany({ role: roleId }, { $set: { role: defaultRole._id } });
    await this.invalidateUsersCache(roleId);

    await this.roleModel.findByIdAndDelete(roleId);
    return { message: this.i18n.translate('exception.role.SUCCESS_DELETE') };
  }

  /**
   * تم استبدال N+1 Queries بـ MongoDB Aggregation لأداء فائق السرعة
   */
  async getAllRoles(): Promise<any[]> {
    return this.roleModel.aggregate([
      {
        $lookup: {
          from: 'users', // تأكد أن اسم الـ Collection في قاعدة البيانات هو users (غالباً بالجمع)
          localField: '_id',
          foreignField: 'role',
          as: 'assignedUsers'
        }
      },
      {
        $addFields: {
          userCount: { $size: '$assignedUsers' }
        }
      },
      {
        $project: {
          assignedUsers: 0 // إزالة مصفوفة المستخدمين لتخفيف حجم الـ Response
        }
      },
      {
        $sort: { level: -1 }
      }
    ]);
  }

  getGroupedPermissions(): any[] {
    const groupsMap = PERMISSIONS_METADATA.reduce((acc, meta) => {
      if (!acc[meta.group]) acc[meta.group] = [];
      acc[meta.group].push({ key: meta.key, label: meta.label });
      return acc;
    }, {} as Record<string, { key: string; label: string }[]>);

    return Object.entries(groupsMap).map(([group, permissions]) => ({
      group,
      permissions,
    }));
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = `user_permissions:${userId}`;
    let userPermissions = await this.cacheManager.get<string[]>(cacheKey);

    if (!userPermissions) {
      const user = await this.userModel
        .findById(userId)
        .select('role')
        .populate<{ role: RoleDocument }>('role', 'permissions')
        .lean();

      userPermissions = user?.role?.permissions || [];
      await this.cacheManager.set(cacheKey, userPermissions, 1000 * 60 * 60 * 12); // 12 Hours
    }

    return userPermissions;
  }
}