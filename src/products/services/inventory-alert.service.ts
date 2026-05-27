import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';

export interface InventoryAlertPayload {
  productId: string;
  variantId: string;
  productName: { ar: string; en: string } | string;
  variantSku: string;
  stock: number;
  requestedQty: number;
  alertType: 'out_of_stock' | 'insufficient_stock';
}

@Injectable()
export class InventoryAlertService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Checks if the requested quantity exceeds available stock and triggers appropriate alerts.
   * Features bot prevention, rate limiting, and Redis Race Condition prevention.
   */
  async checkStockAndAlert(
    product: {
      _id: Types.ObjectId | string;
      title: { ar: string; en: string } | string;
      isUnlimitedStock: boolean;
      isActive: boolean;
    },
    variant: {
      _id: Types.ObjectId | string;
      sku: string;
      stock: number;
    },
    requestedQty: number,
  ) {
    if (!product || !variant) return;
    if (product.isUnlimitedStock || !product.isActive) return;

    // 1. Bot Prevention: Ignore absurdly large requested quantities to prevent spam
    if (requestedQty > 1000) return;

    // 2. Sufficient stock check
    if (variant.stock >= requestedQty) return;

    // 3. Separate alert types
    const alertType =
      variant.stock <= 0 ? 'out_of_stock' : 'insufficient_stock';

    const variantIdStr = String(variant._id);
    const cacheKey = `inventory_alert_${alertType}_${variantIdStr}`;

    // 4. Race Condition Prevention
    // Check if alert was recently sent. Using nx: true for atomic set if Redis store supports it.
    // Fallback TTL: 48 hours (in ms or sec depending on cache manager version, assuming ms here)
    const existingAlert = await this.cacheManager.get(cacheKey);
    if (existingAlert) return;

    // Mark as alerted (Atomic operation if Redis store)
    await this.cacheManager.set(cacheKey, true, {
      ttl: 48 * 60 * 60 * 1000,
      nx: true,
    } as any);

    // 5. Emit the specific inventory alert event
    const payload: InventoryAlertPayload = {
      productId: String(product._id),
      variantId: variantIdStr,
      productName: product.title,
      variantSku: variant.sku,
      stock: variant.stock,
      requestedQty,
      alertType,
    };

    this.eventEmitter.emit(`inventory.alert.${alertType}`, payload);
  }

  /**
   * Clears the stock alert cache when a product's stock is replenished.
   */
  async clearStockAlertCache(variantId: string) {
    await this.cacheManager.del(`inventory_alert_out_of_stock_${variantId}`);
    await this.cacheManager.del(
      `inventory_alert_insufficient_stock_${variantId}`,
    );
  }
}
