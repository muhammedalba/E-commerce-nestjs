import { Transform, TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

/** Upper bound of products per request — an order rarely has more items. */
export const MAX_PRODUCT_IDS = 50;

/**
 * Query for `GET /reviews/me?productIds=a,b,c` — the current user's reviews
 * on several products at once (used by the order details page).
 */
export class MyReviewsQueryDto {
  // 1) Accept a comma-separated string (?productIds=a,b) or repeated params
  //    (?productIds=a&productIds=b), trim, drop empties and duplicates.
  @Transform(({ value }: TransformFnParams): unknown => {
    const raw: unknown = value;
    const list: unknown[] = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? raw.split(',')
        : [];
    return [
      ...new Set(
        list
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      ),
    ];
  })
  // 2) Must be a non-empty, bounded array of ObjectIds
  @IsArray()
  @ArrayNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @ArrayMaxSize(MAX_PRODUCT_IDS)
  @IsMongoId({
    each: true,
    message: i18nValidationMessage('validation.IS_MONGO_ID'),
  })
  productIds!: string[];
}
