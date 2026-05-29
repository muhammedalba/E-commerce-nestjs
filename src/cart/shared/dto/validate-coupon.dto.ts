import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class ValidateCouponDto {
  @IsString()
  @IsNotEmpty({ message: 'Coupon code is required' })
  code!: string;

  @IsNumber()
  @Min(0, { message: 'Order amount must be a positive number' })
  orderAmount!: number;
}
