import { IsIn } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { ReviewStatus } from '../enums/review-status.enum';

// The admin only accepts or rejects — the pending status is set by the server when creating/editing
export class UpdateReviewStatusDto {
  @IsIn([ReviewStatus.APPROVED, ReviewStatus.REJECTED], {
    message: i18nValidationMessage('validation.IS_ENUM'),
  })
  status!: ReviewStatus.APPROVED | ReviewStatus.REJECTED;
}
