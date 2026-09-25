import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * A single guest cart line sent from localStorage.
 *
 * Existence is NOT validated here (unlike CreateCartDto): stale product/variant IDs
 * from the guest's localStorage are skipped by the service instead of failing the
 * whole sync — otherwise one bad line would block the entire guest cart forever.
 */
export class SyncCartItemDto {
  @IsMongoId()
  productId!: string;

  // May be an empty string for legacy guest items added before variants were loaded
  @IsString()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  quantity!: number;
}

export class SyncCartDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncCartItemDto)
  items!: SyncCartItemDto[];
}
