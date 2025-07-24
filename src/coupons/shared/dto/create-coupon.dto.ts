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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCouponDto {
  @ApiProperty({ description: 'Name of the coupon', example: 'SUMMER2024' })
  @IsString()
  @IsNotEmpty({ message: 'Coupon name is required' })
  @Length(3, 20, { message: 'Coupon name must be between 3 and 20 characters' })
  name!: string;

  @ApiProperty({ description: 'Type of the coupon', enum: ['percentage', 'fixed'], example: 'percentage' })
  @IsEnum(['percentage', 'fixed'], {
    message: 'Coupon type must be percentage or fixed',
  })
  type!: 'percentage' | 'fixed';

  @ApiPropertyOptional({ description: 'What the coupon applies to', enum: ['all', 'products', 'categories', 'brands'], example: 'all' })
  @IsEnum(['all', 'products', 'categories', 'brands'], {
    message: 'applyTo must be one of all, products, categories, brands',
  })
  @IsOptional()
  applyTo?: 'all' | 'products' | 'categories' | 'brands';

  @ApiPropertyOptional({ description: 'Array of item IDs the coupon applies to', type: [String], example: ['60d21b4667d0d8992e610c85'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  applyItems?: string[];

  @ApiProperty({ description: 'Expiration date of the coupon', example: '2025-12-31T23:59:59.000Z' })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty({ message: 'Coupon expire time is required' })
  @IsFutureDate({ message: 'Expire date must be in the future' })
  expires!: Date;

  @ApiProperty({ description: 'Discount value of the coupon', example: 10 })
  @IsNumber()
  @Min(1, { message: 'Coupon discount must be at least 1.0' })
  @Max(1000, { message: 'Coupon discount must not exceed 1000.0' })
  @IsNotEmpty({ message: 'Coupon discount is required' })
  discount!: number;

  @ApiPropertyOptional({ description: 'Whether the coupon is active', default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Number of times the coupon has been used', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  usageCount?: number;

  @ApiPropertyOptional({ description: 'Maximum number of times the coupon can be used', default: 100 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxUsage?: number;

  @ApiPropertyOptional({ description: 'Minimum order amount for the coupon to be valid', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum order amount for the coupon to be valid' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxOrderAmount?: number;

  @ApiPropertyOptional({ description: 'Array of user IDs who have used the coupon', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  usedByUsers?: string[];
}
