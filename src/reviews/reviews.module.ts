import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/auth/auth.module';
import { SettingsModule } from 'src/settings/settings.module';
import {
  Product,
  ProductSchema,
} from 'src/products/shared/schemas/Product.schema';
import { Order, OrderSchema } from 'src/order/shared/schemas/Order.schema';
import { Role, RoleSchema } from 'src/roles/shared/schemas/role.schema';
import { Review, ReviewSchema } from './shared/schemas/review.schema';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsEnabledGuard } from './shared/guards/reviews-enabled.guard';

// ─── Separated services ───────────────────────────────
import { ReviewsQueryService } from './services/reviews-query.service';
import { ReviewsMutationService } from './services/reviews-mutation.service';
import { ReviewsModerationService } from './services/reviews-moderation.service';
import { ReviewEligibilityService } from './services/review-eligibility.service';
import { ReviewRatingSyncService } from './services/review-rating-sync.service';
import { ReviewNotificationListener } from './services/review-notification.listener';
import { ReviewCleanupListener } from './services/review-cleanup.listener';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Product.name, schema: ProductSchema },
      // Order: purchase verification (OrderModule does not export its model)
      { name: Order.name, schema: OrderSchema },
      // Role: find roles that should be notified about new reviews
      { name: Role.name, schema: RoleSchema },
    ]),
    AuthModule,
    SettingsModule,
  ],
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    ReviewsQueryService,
    ReviewsMutationService,
    ReviewsModerationService,
    ReviewEligibilityService,
    ReviewRatingSyncService,
    ReviewNotificationListener,
    ReviewCleanupListener,
    ReviewsEnabledGuard,
  ],
})
export class ReviewsModule {}
