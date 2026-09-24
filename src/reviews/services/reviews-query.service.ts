import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PopulateOptions, Types } from 'mongoose';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { Review, ReviewDocument } from '../shared/schemas/review.schema';
import { ReviewStatus } from '../shared/enums/review-status.enum';
import { ReviewEligibilityService } from './review-eligibility.service';

const PUBLIC_USER_POPULATE: PopulateOptions = {
  path: 'user',
  select: 'name avatar',
};
const ADMIN_POPULATE: PopulateOptions[] = [
  { path: 'user', select: 'name email avatar' },
  {
    path: 'product',
    select: 'title slug imageCover isDeleted isActive',
    // Product's pre('find') hooks hide soft-deleted / inactive products unless
    // the filter mentions those fields. The admin still needs to see them
    // (flagged in the UI), so match every state explicitly ($in null = missing).
    match: {
      isDeleted: { $in: [true, false, null] },
      isActive: { $in: [true, false, null] },
    },
  },
];

/**
 * Read-side of the reviews module: storefront list, the current user's
 * review, the admin moderation list and status statistics.
 */
@Injectable()
export class ReviewsQueryService {
  private static readonly MAX_LIMIT = 50;
  private static readonly MAX_PAGE = 500;
  private static readonly MAX_KEYWORDS_LENGTH = 100;
  // Sorts allowed on the public list: newest/oldest, highest/lowest rating
  private static readonly PUBLIC_SORTS = new Set([
    '-createdAt',
    'createdAt',
    '-rating',
    'rating',
  ]);

  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly eligibility: ReviewEligibilityService,
    private readonly i18n: CustomI18nService,
  ) {}

  // ------------ =============================== ---------- //
  // ------------ ====  approved (storefront)  ==== ---------- //
  // ------------ =============================== ---------- //
  async findApprovedByProduct(productId: string, queryString: QueryString) {
    // Only pagination/sort/rating are accepted from the public query —
    // `status` is always forced to approved server-side.
    const { page, limit } = queryString;
    const publicQuery: QueryString = { page, limit };
    // Whitelisted sorts only (unknown values fall back to newest first)
    if (
      queryString.sort &&
      ReviewsQueryService.PUBLIC_SORTS.has(queryString.sort)
    ) {
      publicQuery.sort = queryString.sort;
    }
    const rating: unknown = queryString.rating;
    if (typeof rating === 'string') publicQuery.rating = rating;

    return this.paginate(
      {
        product: new Types.ObjectId(productId),
        status: ReviewStatus.APPROVED,
      },
      publicQuery,
      PUBLIC_USER_POPULATE,
    );
  }

  // ------------ =============================== ---------- //
  // ------------ ======  my review + eligibility  ====== ---------- //
  // ------------ =============================== ---------- //
  async findMine(userId: string, productId: string) {
    const [review, eligibility] = await Promise.all([
      this.reviewModel
        .findOne({
          user: new Types.ObjectId(userId),
          product: new Types.ObjectId(productId),
        })
        .select('-__v')
        // Same author shape as the public list, so ReviewItem renders it as-is
        .populate(PUBLIC_USER_POPULATE)
        .lean(),
      this.eligibility.getEligibility(userId, productId),
    ]);

    return {
      review: review ? this.i18n.localize(review) : null,
      ...eligibility,
    };
  }

  // ------------ =============================== ---------- //
  // ------------ ====  my reviews on many products  ==== ---------- //
  // ------------ =============================== ---------- //
  /**
   * The current user's reviews (any status) on several products in ONE query
   * — lets the order details page render every item's review state without
   * an N+1 of `/product/:id/me` calls.
   *
   * No eligibility check: this is only a read; creating/editing still goes
   * through the regular endpoints (and their purchase / settings checks).
   */
  async findMineByProducts(userId: string, productIds: string[]) {
    // 1) One indexed query: {user, product} is covered by the unique index
    const reviews = await this.reviewModel
      .find({
        user: new Types.ObjectId(userId),
        product: { $in: productIds.map((id) => new Types.ObjectId(id)) },
      })
      .select('-__v')
      .lean();

    // 2) Same localization as the other read endpoints (ids → strings)
    return this.i18n.localize(reviews);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  admin list  ====== ---------- //
  // ------------ =============================== ---------- //
  async findAllForAdmin(queryString: QueryString) {
    return this.paginate({}, queryString, ADMIN_POPULATE);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  statistics  ====== ---------- //
  // ------------ =============================== ---------- //
  async statistics() {
    const grouped = await this.reviewModel.aggregate<{
      _id: ReviewStatus;
      count: number;
    }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

    const counts = Object.fromEntries(
      Object.values(ReviewStatus).map((status) => [
        status,
        grouped.find((g) => g._id === status)?.count ?? 0,
      ]),
    ) as Record<ReviewStatus, number>;

    return {
      ...counts,
      total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    };
  }

  // ------------ =============================== ---------- //
  // ------------ ======  shared pagination  ====== ---------- //
  // ------------ =============================== ---------- //
  /**
   * Same flow as `BaseService.findAllDoc`, but with a fixed base filter and
   * multiple populate paths (BaseService only supports a single one).
   */
  private async paginate(
    baseFilter: FilterQuery<ReviewDocument>,
    queryString: QueryString,
    populate: PopulateOptions | PopulateOptions[],
  ) {
    const clamp = (raw: string | undefined, fallback: number, max: number) =>
      String(Math.min(Math.max(parseInt(raw ?? '', 10) || fallback, 1), max));

    const safeQuery: QueryString = {
      ...queryString,
      limit: clamp(queryString.limit, 10, ReviewsQueryService.MAX_LIMIT),
      // bounds the `skip` cost of deep pagination
      page: clamp(queryString.page, 1, ReviewsQueryService.MAX_PAGE),
    };
    // Regex search is unindexed — keep the pattern short
    if (typeof queryString.keywords === 'string') {
      safeQuery.keywords = queryString.keywords.slice(
        0,
        ReviewsQueryService.MAX_KEYWORDS_LENGTH,
      );
    }

    const features = new ApiFeatures(
      this.reviewModel.find(),
      safeQuery,
    ).filter();
    features.search(String(MODEL_NAMES.REVIEW));
    // Applied after filter() so the base filter can never be overridden
    // by a query param with the same key.
    features.getQuery().where(baseFilter);

    const total = await this.reviewModel.countDocuments(
      features.getQuery().getFilter(),
    );

    features.sort().limitFields().paginate(total);

    const data = await features.getQuery().populate(populate).lean().exec();

    return {
      results: data.length,
      pagination: features.getPagination(),
      data: this.i18n.localize(data),
    };
  }
}
