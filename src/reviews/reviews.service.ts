import { Injectable } from '@nestjs/common';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { ReviewsQueryService } from './services/reviews-query.service';
import { ReviewsMutationService } from './services/reviews-mutation.service';
import { ReviewsModerationService } from './services/reviews-moderation.service';
import { CreateReviewDto } from './shared/dto/create-review.dto';
import { UpdateReviewDto } from './shared/dto/update-review.dto';
import { ReviewStatus } from './shared/enums/review-status.enum';

/**
 * Facade service — delegates to specialized sub-services.
 * Keeps the Controller contract unchanged while the internal
 * implementation is cleanly separated by responsibility.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly queryService: ReviewsQueryService,
    private readonly mutationService: ReviewsMutationService,
    private readonly moderationService: ReviewsModerationService,
  ) {}

  // =========================================================================================
  //  READ OPERATIONS (delegated to QueryService)
  // =========================================================================================

  async findApprovedByProduct(productId: string, queryString: QueryString) {
    return this.queryService.findApprovedByProduct(productId, queryString);
  }

  async findMine(userId: string, productId: string) {
    return this.queryService.findMine(userId, productId);
  }

  async findMineByProducts(userId: string, productIds: string[]) {
    return this.queryService.findMineByProducts(userId, productIds);
  }

  async findAllForAdmin(queryString: QueryString) {
    return this.queryService.findAllForAdmin(queryString);
  }

  async statistics() {
    return this.queryService.statistics();
  }

  // =========================================================================================
  //  CUSTOMER WRITE OPERATIONS (delegated to MutationService)
  // =========================================================================================

  async create(userId: string, productId: string, dto: CreateReviewDto) {
    return this.mutationService.create(userId, productId, dto);
  }

  async updateMine(userId: string, reviewId: string, dto: UpdateReviewDto) {
    return this.mutationService.updateMine(userId, reviewId, dto);
  }

  // =========================================================================================
  //  ADMIN OPERATIONS (delegated to ModerationService)
  // =========================================================================================

  async updateStatus(
    reviewId: string,
    status: ReviewStatus.APPROVED | ReviewStatus.REJECTED,
  ) {
    return this.moderationService.updateStatus(reviewId, status);
  }

  async reply(reviewId: string, adminId: string, text: string) {
    return this.moderationService.reply(reviewId, adminId, text);
  }

  async delete(reviewId: string) {
    return this.moderationService.delete(reviewId);
  }
}
