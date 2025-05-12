import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsDate,
  IsNumber,
  Min,
  Max,
  Length,
} from 'class-validator';
import { IsFutureDate } from 'src/shared/utils/decorators/is-future-date.decorator';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty({ message: 'Coupon name is required' })
  @Length(3, 20, { message: 'Coupon name must be between 3 and 20 characters' })
  name?: string;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty({ message: 'Coupon expire time is required' })
  @IsFutureDate({ message: 'Expire date must be in the future' })
  expires?: Date;

  @IsNumber()
  @Min(1, { message: 'Coupon discount must be at least 1.0' })
  @Max(100, { message: 'Coupon discount must not exceed 100.0' })
  @IsNotEmpty({ message: 'Coupon discount is required' })
  discount?: number;
}
