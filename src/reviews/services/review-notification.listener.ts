import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from 'src/roles/shared/schemas/role.schema';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import {
  Product,
  ProductDocument,
} from 'src/products/shared/schemas/Product.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import {
  REVIEW_EVENTS,
  ReviewActivityEvent,
} from '../shared/events/review.events';

/**
 * Turns review events into notifications:
 * - new/edited review → every role that can moderate reviews
 * - approved / replied → the review author
 *
 * Delivery (SSE + persistence) is handled by NotificationsEventListener,
 * which subscribes to `role.notification.*` and `user.notification.*`.
 */
@Injectable()
export class ReviewNotificationListener {
  private readonly logger = new Logger(ReviewNotificationListener.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly eventEmitter: EventEmitter2,
    private readonly i18n: CustomI18nService,
  ) {}

  @OnEvent(REVIEW_EVENTS.SUBMITTED, { async: true })
  async handleSubmitted(event: ReviewActivityEvent) {
    try {
      const roles = await this.roleModel
        .find({ permissions: { $in: [Permissions.MANAGE_REVIEWS] } })
        .select('_id')
        .lean();
      if (!roles.length) return;

      const message = await this.buildMessage(
        'notification.NEW_REVIEW_PENDING',
        event.productId,
      );

      for (const role of roles) {
        const roleId = role._id.toString();
        this.eventEmitter.emit(`role.notification.${roleId}`, {
          roleId,
          action: 'NEW_REVIEW_PENDING',
          message,
          payload: { reviewId: event.reviewId, productId: event.productId },
        });
      }
    } catch (error) {
      this.logger.error('Failed to notify admins about a new review', error);
    }
  }

  @OnEvent(REVIEW_EVENTS.APPROVED, { async: true })
  async handleApproved(event: ReviewActivityEvent) {
    await this.notifyAuthor(
      event,
      'REVIEW_APPROVED',
      'notification.REVIEW_APPROVED',
    );
  }

  @OnEvent(REVIEW_EVENTS.REPLIED, { async: true })
  async handleReplied(event: ReviewActivityEvent) {
    await this.notifyAuthor(
      event,
      'REVIEW_REPLIED',
      'notification.REVIEW_REPLIED',
    );
  }

  private async notifyAuthor(
    event: ReviewActivityEvent,
    action: string,
    messageKey: string,
  ) {
    try {
      const message = await this.buildMessage(messageKey, event.productId);
      this.eventEmitter.emit(`user.notification.${event.userId}`, {
        userId: event.userId,
        action,
        message,
        payload: { reviewId: event.reviewId, productId: event.productId },
      });
    } catch (error) {
      this.logger.error(`Failed to send ${action} notification`, error);
    }
  }

  /** Builds `{ ar, en }` with the product title in the matching language. */
  private async buildMessage(key: string, productId: string) {
    const product = await this.productModel
      .findById(productId)
      .select('title')
      .lean();
    const title = product?.title ?? { ar: '', en: '' };
    return {
      ar: this.i18n.translate(key, { lang: 'ar', args: { product: title.ar } }),
      en: this.i18n.translate(key, { lang: 'en', args: { product: title.en } }),
    };
  }
}
