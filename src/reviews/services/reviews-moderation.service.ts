import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model, Types } from 'mongoose';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { Review, ReviewDocument } from '../shared/schemas/review.schema';
import { ReviewStatus } from '../shared/enums/review-status.enum';
import {
  REVIEW_EVENTS,
  ReviewActivityEvent,
  ReviewChangedEvent,
} from '../shared/events/review.events';

/**
 * Admin-side writes: approve / reject, reply once, delete.
 */
@Injectable()
export class ReviewsModerationService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly eventEmitter: EventEmitter2,
    private readonly i18n: CustomI18nService,
  ) {}

  // ------------ =============================== ---------- //
  // ------------ ======  approve / reject   ====== ---------- //
  // ------------ =============================== ---------- //
  async updateStatus(
    reviewId: string,
    status: ReviewStatus.APPROVED | ReviewStatus.REJECTED,
  ) {
    // Returns the document *before* the update so we know the previous status.
    const previous = await this.reviewModel
      .findByIdAndUpdate(
        new Types.ObjectId(reviewId),
        { $set: { status } },
        { new: false },
      )
      .select('status product user')
      .lean();
    if (!previous) this.throwNotFound();

    /*
    * previous.status → status         | CHANGED | APPROVED
    ─────────────────────────────────|─────────|─────────
    * PENDING  → APPROVED              |    ✅   |    ✅
    * APPROVED → REJECTED              |    ✅   |    ❌
    * PENDING  → REJECTED              |    ❌   |    ❌
    * REJECTED → APPROVED              |    ✅   |    ✅
    * APPROVED → APPROVED              |    ❌   |    ❌
    */
    if (previous.status !== status) {
      // Average only changes when a review enters or leaves the approved set.
      if (
        previous.status === ReviewStatus.APPROVED ||
        status === ReviewStatus.APPROVED
      ) {
        this.eventEmitter.emit(
          REVIEW_EVENTS.CHANGED,
          new ReviewChangedEvent(previous.product),
        );
      }
      if (status === ReviewStatus.APPROVED) {
        this.eventEmitter.emit(
          REVIEW_EVENTS.APPROVED,
          new ReviewActivityEvent(
            reviewId,
            previous.product.toString(),
            previous.user.toString(),
          ),
        );
      }
    }

    return { _id: reviewId, status };
  }

  // ------------ =============================== ---------- //
  // ------------ ======  reply (once)   ====== ---------- //
  // ------------ =============================== ---------- //
  async reply(reviewId: string, adminId: string, text: string) {
    // Atomic "reply only if there is no reply yet" — no read-then-write race.
    const updated = await this.reviewModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(reviewId), adminReply: null },
        {
          $set: {
            adminReply: {
              text,
              repliedBy: new Types.ObjectId(adminId),
              repliedAt: new Date(),
            },
          },
        },
        { new: true, runValidators: true },
      )
      .select('-__v')
      .lean();

    if (!updated) {
      const exists = await this.reviewModel.exists({
        _id: new Types.ObjectId(reviewId),
      });
      if (!exists) this.throwNotFound();
      throw new ConflictException(
        this.i18n.translate('exception.review.REPLY_ALREADY_EXISTS'),
      );
    }

    this.eventEmitter.emit(
      REVIEW_EVENTS.REPLIED,
      new ReviewActivityEvent(
        reviewId,
        updated.product.toString(),
        updated.user.toString(),
      ),
    );

    return updated;
  }

  // ------------ =============================== ---------- //
  // ------------ ======  delete review   ====== ---------- //
  // ------------ =============================== ---------- //
  async delete(reviewId: string) {
    const deleted = await this.reviewModel
      .findByIdAndDelete(new Types.ObjectId(reviewId))
      .select('status product')
      .lean();
    if (!deleted) this.throwNotFound();

    if (deleted.status === ReviewStatus.APPROVED) {
      this.eventEmitter.emit(
        REVIEW_EVENTS.CHANGED,
        new ReviewChangedEvent(deleted.product),
      );
    }

    return { _id: reviewId };
  }

  private throwNotFound(): never {
    throw new NotFoundException(
      this.i18n.translate('exception.review.NOT_FOUND'),
    );
  }
}
