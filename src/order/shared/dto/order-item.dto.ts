import { Type } from 'class-transformer';
import { IsMongoId, IsNumber, IsPositive, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class OrderItemDto {
  @IsMongoId({ message: i18nValidationMessage('validation.IS_MONGO_ID') })
  @Type(() => String)
  productId!: string;

  @IsMongoId({ message: i18nValidationMessage('validation.IS_MONGO_ID') })
  @Type(() => String)
  variantId!: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}
