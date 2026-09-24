import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { Throttle } from '@nestjs/throttler';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './shared/dto/create-review.dto';
import { UpdateReviewDto } from './shared/dto/update-review.dto';
import { UpdateReviewStatusDto } from './shared/dto/update-review-status.dto';
import { ReplyReviewDto } from './shared/dto/reply-review.dto';
import {
  ProductIdParamDto,
  ReviewIdParamDto,
} from './shared/dto/review-params.dto';
import { ReviewsEnabledGuard } from './shared/guards/reviews-enabled.guard';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('reviews')
@UseInterceptors(ClearCacheInterceptor)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // =====================================================================
  //  STOREFRONT
  // =====================================================================

  // ------------ ======  approved reviews of a product (public)  ====== ---------- //
  @Get('product/:productId')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async findApprovedByProduct(
    @Param() { productId }: ProductIdParamDto,
    @Query() queryString: QueryString,
  ) {
    return await this.reviewsService.findApprovedByProduct(
      productId,
      queryString,
    );
  }

  // ------------ ======  my review + eligibility  ====== ---------- //
  @Get('product/:productId/me')
  @UseGuards(AuthGuard)
  async findMine(
    @Param() { productId }: ProductIdParamDto,
    @Req() req: { user: JwtPayload },
  ) {
    return await this.reviewsService.findMine(req.user.user_id, productId);
  }

  // ------------ ======  create review  ====== ---------- //
  @Post('product/:productId')
  @UseGuards(AuthGuard, ReviewsEnabledGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 attempts per minute
  @ClearCache('reviews')
  async create(
    @Param() { productId }: ProductIdParamDto,
    @Body() createReviewDto: CreateReviewDto,
    @Req() req: { user: JwtPayload },
  ) {
    return await this.reviewsService.create(
      req.user.user_id,
      productId,
      createReviewDto,
    );
  }

  // ------------ ======  update my review  ====== ---------- //
  @Patch('me/:id')
  @UseGuards(AuthGuard, ReviewsEnabledGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ClearCache('reviews')
  async updateMine(
    @Param() { id }: ReviewIdParamDto,
    @Body() updateReviewDto: UpdateReviewDto,
    @Req() req: { user: JwtPayload },
  ) {
    return await this.reviewsService.updateMine(
      req.user.user_id,
      id,
      updateReviewDto,
    );
  }

  // =====================================================================
  //  ADMIN
  // =====================================================================

  // ------------ ======  all reviews (moderation list)  ====== ---------- //
  @Get()
  @RequirePermission(Permissions.VIEW_REVIEWS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async findAllForAdmin(@Query() queryString: QueryString) {
    return await this.reviewsService.findAllForAdmin(queryString);
  }

  // ------------ ======  statistics (counts per status)  ====== ---------- //
  @Get('statistics')
  @RequirePermission(Permissions.VIEW_REVIEWS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async statistics() {
    return await this.reviewsService.statistics();
  }

  // ------------ ======  approve / reject  ====== ---------- //
  @Patch(':id/status')
  @RequirePermission(Permissions.MANAGE_REVIEWS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('reviews')
  async updateStatus(
    @Param() { id }: ReviewIdParamDto,
    @Body() { status }: UpdateReviewStatusDto,
  ) {
    return await this.reviewsService.updateStatus(id, status);
  }

  // ------------ ======  reply (once)  ====== ---------- //
  @Patch(':id/reply')
  @RequirePermission(Permissions.MANAGE_REVIEWS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('reviews')
  async reply(
    @Param() { id }: ReviewIdParamDto,
    @Body() { text }: ReplyReviewDto,
    @Req() req: { user: JwtPayload },
  ) {
    return await this.reviewsService.reply(id, req.user.user_id, text);
  }

  // ------------ ======  delete review  ====== ---------- //
  @Delete(':id')
  @RequirePermission(Permissions.DELETE_REVIEW)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('reviews')
  async remove(@Param() { id }: ReviewIdParamDto) {
    return await this.reviewsService.delete(id);
  }
}
