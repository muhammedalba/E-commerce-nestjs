import { Type } from 'class-transformer';
import { IsMongoId, IsNumber, IsPositive, Min } from 'class-validator';

export class OrderItemDto {
  @IsMongoId({ message: 'معرّف المنتج غير صالح' })
  @Type(() => String)
  productId!: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}
