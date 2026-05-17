import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../shared/schemas/role.schema';
import { Permissions } from '../shared/enums/permissions.enum';

@Injectable()
export class RolesSeederService implements OnModuleInit {
  private readonly logger = new Logger(RolesSeederService.name);

  constructor(@InjectModel(Role.name) private roleModel: Model<Role>) {}

  async onModuleInit() {
    await this.seedRoles();
  }

  public async seedRoles() {
    const rolesToSeed = [
      {
        name: 'SuperAdmin',
        description: 'System Administrator with full access to everything',
        permissions: Object.values(Permissions),
        isSystemDefined: true,
        level: 100,
      },
      {
        name: 'Admin',
        description: 'Administrator with high-level access',
        permissions: [
          Permissions.ACCESS_DASHBOARD,
          Permissions.VIEW_DASHBOARD_STATS,
          Permissions.VIEW_USERS,
          Permissions.CREATE_USER,
          Permissions.UPDATE_USER,
          Permissions.DELETE_USER,
          Permissions.VIEW_SUPPLIERS,
          Permissions.CREATE_SUPPLIER,
          Permissions.UPDATE_SUPPLIER,
          Permissions.DELETE_SUPPLIER,
          Permissions.VIEW_ROLES,
          Permissions.CREATE_ROLE,
          Permissions.UPDATE_ROLE,
          Permissions.DELETE_ROLE,
          Permissions.VIEW_CATEGORIES,
          Permissions.CREATE_CATEGORY,
          Permissions.UPDATE_CATEGORY,
          Permissions.DELETE_CATEGORY,
          Permissions.VIEW_SUB_CATEGORIES,
          Permissions.CREATE_SUB_CATEGORY,
          Permissions.UPDATE_SUB_CATEGORY,
          Permissions.DELETE_SUB_CATEGORY,
          Permissions.VIEW_BRANDS,
          Permissions.CREATE_BRAND,
          Permissions.UPDATE_BRAND,
          Permissions.DELETE_BRAND,
          Permissions.VIEW_PRODUCTS,
          Permissions.VIEW_PRODUCTS_STATS,
          Permissions.CREATE_PRODUCT,
          Permissions.UPDATE_PRODUCT,
          Permissions.DELETE_PRODUCT,
          Permissions.VIEW_ORDERS,
          Permissions.UPDATE_ORDER_STATUS,
          Permissions.DELETE_ORDER,
          Permissions.REFUND_ORDER,
          Permissions.VIEW_COUPONS,
          Permissions.CREATE_COUPON,
          Permissions.UPDATE_COUPON,
          Permissions.DELETE_COUPON,
          Permissions.VIEW_PROMO_BANNERS,
          Permissions.CREATE_PROMO_BANNER,
          Permissions.UPDATE_PROMO_BANNER,
          Permissions.DELETE_PROMO_BANNER,
          Permissions.VIEW_SHIPPING,
          Permissions.CREATE_SHIPPING,
          Permissions.UPDATE_SHIPPING,
          Permissions.DELETE_SHIPPING,
          Permissions.VIEW_SHIPPING_RATES,
          Permissions.VIEW_TAXES,
          Permissions.CREATE_TAX,
          Permissions.UPDATE_TAX,
          Permissions.DELETE_TAX,
          Permissions.VIEW_LOCATIONS,
          Permissions.CREATE_LOCATION,
          Permissions.UPDATE_LOCATION,
          Permissions.DELETE_LOCATION,
          Permissions.VIEW_EXTERNAL_PLATFORMS,
          Permissions.VIEW_SETTINGS,
          Permissions.UPDATE_SETTINGS,
        ],
        isSystemDefined: true,
        level: 50,
      },
      {
        name: 'Manager',
        description: 'Manager with operational access',
        permissions: [
          Permissions.ACCESS_DASHBOARD,
          Permissions.VIEW_DASHBOARD_STATS,
          Permissions.VIEW_PRODUCTS,
          Permissions.VIEW_PRODUCTS_STATS,
          Permissions.UPDATE_PRODUCT,
          Permissions.VIEW_ORDERS,
          Permissions.UPDATE_ORDER_STATUS,
        ],
        isSystemDefined: true,
        level: 30,
      },
      {
        name: 'User',
        description: 'Regular registered user',
        permissions: [
          Permissions.ACCESS_DASHBOARD, // Or whatever baseline access is needed
        ],
        isSystemDefined: true,
        level: 1,
      },
    ];

    for (const roleData of rolesToSeed) {
      const existingRole = await this.roleModel.findOne({
        name: roleData.name,
      });
      if (!existingRole) {
        await this.roleModel.create(roleData);
        this.logger.log(
          `✅ Role ${roleData.name} has been seeded successfully.`,
        );
      } else if (roleData.name === 'SuperAdmin') {
        // Only reset SuperAdmin to guarantee level 100 and all permissions
        await this.roleModel.updateOne(
          { name: roleData.name },
          {
            $set: {
              permissions: roleData.permissions,
              level: roleData.level,
            },
          },
        );
        this.logger.log(
          `🔄 Role ${roleData.name} permissions and level have been synchronized.`,
        );
      }
    }

    // After seeding roles, repair legacy user data
    await this.repairLegacyRoles();
  }

  private async repairLegacyRoles() {
    this.logger.log(
      '🔍 Checking for legacy string-based roles in User collection...',
    );

    const adminRole = await this.roleModel.findOne({ name: 'Admin' });
    const managerRole = await this.roleModel.findOne({ name: 'Manager' });
    const userRole = await this.roleModel.findOne({ name: 'User' });

    if (!adminRole || !managerRole || !userRole) {
      this.logger.warn(
        '⚠️ Cannot repair legacy roles: standard roles not found in DB.',
      );
      return;
    }

    // Find users where role is a string (legacy)
    // In MongoDB, we can use $type: "string"
    const usersToUpdate = [
      { legacy: 'admin', target: adminRole._id },
      { legacy: 'Admin', target: adminRole._id },
      { legacy: 'manager', target: managerRole._id },
      { legacy: 'Manager', target: managerRole._id },
      { legacy: 'user', target: userRole._id },
      { legacy: 'User', target: userRole._id },
    ];

    for (const mapping of usersToUpdate) {
      const result = await this.roleModel.db
        .collection('users')
        .updateMany(
          { role: mapping.legacy },
          { $set: { role: mapping.target } },
        );

      if (result.modifiedCount > 0) {
        this.logger.log(
          `🔧 Repaired ${result.modifiedCount} users with legacy role "${mapping.legacy}" -> ${mapping.target.toString()}`,
        );
      }
    }

    // 2. Repair any users where role is stored as a stringified ObjectId (24 hex chars)
    const stringRoleUsers = await this.roleModel.db
      .collection('users')
      .find({ role: { $type: 'string' } })
      .toArray();

    let repairedStringIdsCount = 0;
    for (const u of stringRoleUsers) {
      if (typeof u.role === 'string' && /^[0-9a-fA-F]{24}$/.test(u.role)) {
        await this.roleModel.db
          .collection('users')
          .updateOne(
            { _id: u._id },
            { $set: { role: new Types.ObjectId(u.role) } },
          );
        repairedStringIdsCount++;
      }
    }

    if (repairedStringIdsCount > 0) {
      this.logger.log(
        `🔧 Repaired ${repairedStringIdsCount} users with stringified ObjectId roles to BSON ObjectId.`,
      );
    }
  }
}
