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
          Permissions.MANAGE_USERS,
          Permissions.MANAGE_ROLES,
          Permissions.MANAGE_CATEGORIES,
          Permissions.CREATE_PRODUCT,
          Permissions.UPDATE_PRODUCT,
          Permissions.VIEW_ORDERS,
        ],
        isSystemDefined: true,
        level: 50,
      },
      {
        name: 'Manager',
        description: 'Manager with operational access',
        permissions: [
          Permissions.ACCESS_DASHBOARD,
          Permissions.VIEW_PRODUCTS,
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
      } else {
        await this.roleModel.updateOne(
          { name: roleData.name },
          {
            $set: {
              permissions: roleData.permissions,
              level: roleData.level,
            },
          },
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
