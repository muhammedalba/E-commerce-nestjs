import { Types } from 'mongoose';

export const REVIEW_EVENTS = {
  /** A review was created or updated and became pending → notify the admin */
  SUBMITTED: 'review.submitted',
  /** Something that affects the average rating of the product changed (status, update, deletion) */
  CHANGED: 'review.changed',
  /** The admin approved the review → notify the review owner */
  APPROVED: 'review.approved',
  /** The admin replied to the review → notify the review owner */
  REPLIED: 'review.replied',
} as const;

export class ReviewChangedEvent {
  constructor(public readonly productId: Types.ObjectId | string) {}
}

export class ReviewActivityEvent {
  constructor(
    public readonly reviewId: string,
    public readonly productId: string,
    public readonly userId: string,
  ) {}
}
