import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Role, RoleDocument } from 'src/roles/shared/schemas/role.schema';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { InventoryAlertPayload } from './inventory-alert.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

@Injectable()
export class InventoryEventListener {
  private readonly logger = new Logger(InventoryEventListener.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
    private readonly i18n: CustomI18nService,
  ) {}

  @OnEvent('inventory.alert.*', { async: true })
  async handleInventoryAlert(payload: InventoryAlertPayload) {
    try {
      // 1. Find all roles that have UPDATE_PRODUCT permission
      const targetRoles = await this.roleModel
        .find({
          permissions: { $in: [Permissions.UPDATE_PRODUCT] },
        })
        .lean();

      if (!targetRoles.length) return;

      const productNameAr =
        typeof payload.productName === 'string'
          ? payload.productName
          : payload.productName?.ar;
      const productNameEn =
        typeof payload.productName === 'string'
          ? payload.productName
          : payload.productName?.en;

      // 2. Prepare message based on alert type
      let messageAr = '';
      let messageEn = '';

      if (payload.alertType === 'out_of_stock') {
        messageAr = `نفذ المخزون للمنتج "${productNameAr}" (SKU: ${payload.variantSku}). يرجى تجديد المخزون.`;
        messageEn = `Out of stock for product "${productNameEn}" (SKU: ${payload.variantSku}). Please restock.`;
      } else {
        messageAr = `المخزون الحالي (${payload.stock}) للمنتج "${productNameAr}" (SKU: ${payload.variantSku}) لا يكفي لتلبية بعض طلبات العملاء.`;
        messageEn = `Current stock (${payload.stock}) for product "${productNameEn}" (SKU: ${payload.variantSku}) is insufficient to meet recent customer demand.`;
      }

      const action = `INVENTORY_ALERT_${payload.alertType.toUpperCase()}`;

      // 3. Emit role.notification.{roleId} for each target role.
      //    ✅ SSE stream in NotificationsController subscribes to this event → real-time delivery
      //    ✅ NotificationsEventListener also subscribes to role.notification.* → persists to MongoDB
      for (const role of targetRoles) {
        this.eventEmitter.emit(`role.notification.${role._id.toString()}`, {
          roleId: role._id.toString(),
          action,
          message: { ar: messageAr, en: messageEn },
          payload,
        });
      }

      // 4. Send Email to Admin via BullMQ
      await this.mailQueue.add('inventory-alert', {
        email: process.env.ADMIN_EMAIL,
        appName: process.env.APP_NAME || 'SkyGalaxy',
        subject:
          payload.alertType === 'out_of_stock'
            ? 'تنبيه: نفاد مخزون'
            : 'تنبيه: مخزون غير كافٍ',
        payload,
        lang: 'ar',
      });
    } catch (error) {
      this.logger.error(
        'Failed to process inventory alert event',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
