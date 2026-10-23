import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../shared/schemas/role.schema';
import { Permissions } from '../shared/enums/permissions.enum';

@Injectable()
export class RolesSeederService implements OnModuleInit {
  private readonly logger = new Logger(RolesSeederService.name);

  constructor(@InjectModel(Role.name) private roleModel: Model<Role>) {}

  /**
   * Seed roles in background without blocking application bootstrap.
   * Hostinger requires app.listen() to be called within 3 seconds.
   */
  onModuleInit(): void {
    void this.seedRoles().catch((err) => {
      this.logger.error('Failed to seed roles on startup:', err);
    });
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
          Permissions.VIEW_INVOICES,
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
          Permissions.VIEW_REVIEWS,
          Permissions.MANAGE_REVIEWS,
          Permissions.DELETE_REVIEW,
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
          Permissions.VIEW_REVIEWS,
          Permissions.MANAGE_REVIEWS,
        ],
        isSystemDefined: true,
        level: 30,
      },
      {
        name: 'User',
        description: 'Regular registered user',
        permissions: [],
        isSystemDefined: true,
        level: 1,
      },
    ];

    // One atomic upsert per role: inserts a missing role and leaves an existing
    // one untouched (including SuperAdmin, whose access the guards grant by
    // level). Timestamps are written on insert only, so a boot changes nothing.
    const now = new Date();
    const result = await this.roleModel.bulkWrite(
      rolesToSeed.map((roleData) => ({
        updateOne: {
          filter: { name: roleData.name },
          update: {
            $setOnInsert: { ...roleData, createdAt: now, updatedAt: now },
          },
          upsert: true,
          timestamps: false,
        },
      })),
      { ordered: false },
    );

    for (const index of Object.keys(result.upsertedIds)) {
      this.logger.log(
        `✅ Role ${rolesToSeed[Number(index)].name} has been seeded successfully.`,
      );
    }
  }
}
