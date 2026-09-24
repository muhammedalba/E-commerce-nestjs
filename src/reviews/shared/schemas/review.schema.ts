import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { ReviewStatus } from '../enums/review-status.enum';

// Admin Reply — Embedded within the review (only one reply per review, no separate schema)
@Schema({ _id: false })
export class ReviewReply {
  @Prop({ type: String, required: true, trim: true, maxlength: 1000 })
  declare text: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: MODEL_NAMES.USER })
  declare repliedBy: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  declare repliedAt: Date;
}
export const ReviewReplySchema = SchemaFactory.createForClass(ReviewReply);

@Schema({ timestamps: true })
export class Review {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.USER,
    required: true,
  })
  declare user: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: MODEL_NAMES.PRODUCT,
    required: true,
  })
  declare product: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  declare rating: number;

  @Prop({ type: String, required: true, trim: true, maxlength: 1000 })
  declare comment: string;

  // لا يظهر التقييم في المتجر إلا بعد موافقة الأدمن
  @Prop({
    type: String,
    enum: Object.values(ReviewStatus),
    default: ReviewStatus.PENDING,
  })
  declare status: ReviewStatus;

  @Prop({ type: ReviewReplySchema, default: null })
  declare adminReply: ReviewReply | null;

  //Calculated solely from the server (delivered request containing the product) — not accepted from any DTO.
  @Prop({ type: Boolean, default: false })
  declare isVerifiedPurchase: boolean;

  @Prop({ type: Date, default: null })
  declare editedAt: Date | null;

  declare createdAt: Date;
  declare updatedAt: Date;
}

export type ReviewDocument = HydratedDocument<Review>;
export const ReviewSchema = SchemaFactory.createForClass(Review);

// Only one review per user per product — enforced at the database level
// to prevent race conditions between concurrent requests (TOCTOU).
ReviewSchema.index({ user: 1, product: 1 }, { unique: true });
// List of approved reviews on the product page + recalculation of the average rating
ReviewSchema.index({ product: 1, status: 1, createdAt: -1 });
// Admin list by status
ReviewSchema.index({ status: 1, createdAt: -1 });
