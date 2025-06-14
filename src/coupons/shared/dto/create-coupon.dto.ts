import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsDate,
  IsNumber,
  Min,
  Max,
  Length,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsArray,
  ArrayUnique,
} from 'class-validator';
import { IsFutureDate } from 'src/shared/utils/decorators/is-future-date.decorator';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty({ message: 'Coupon name is required' })
  @Length(3, 20, { message: 'Coupon name must be between 3 and 20 characters' })
  name!: string;

  @IsEnum(['percentage', 'fixed'], {
    message: 'Coupon type must be percentage or fixed',
  })
  type!: 'percentage' | 'fixed';

  @IsEnum(['all', 'products', 'categories', 'brands'], {
    message: 'applyTo must be one of all, products, categories, brands',
  })
  @IsOptional()
  appleTo?: 'all' | 'products' | 'categories' | 'brands';

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  appleItems?: string[];

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty({ message: 'Coupon expire time is required' })
  @IsFutureDate({ message: 'Expire date must be in the future' })
  expires!: Date;

  @IsNumber()
  @Min(1, { message: 'Coupon discount must be at least 1.0' })
  @Max(1000, { message: 'Coupon discount must not exceed 1000.0' })
  @IsNotEmpty({ message: 'Coupon discount is required' })
  discount!: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  usageCount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxUsage?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxOrderAmount?: number;

  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  usedByUsers?: string[];
}
