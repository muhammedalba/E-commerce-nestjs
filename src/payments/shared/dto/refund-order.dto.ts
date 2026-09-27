import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class RefundOrderParamDto {
  @IsMongoId()
  orderId!: string;
}

export class RefundOrderDto {
  /** Amount to refund in major units (e.g. 25.5 SAR). Omitted: everything not yet refunded. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  amount?: number;

  /** Why the money is returned; kept in the audit log. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
