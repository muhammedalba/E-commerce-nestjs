import { Type } from 'class-transformer';
import { IsMongoId, IsNumber, IsPositive, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { i18nValidationMessage } from 'nestjs-i18n';

export class OrderItemDto {
  @ApiProperty({
    description: 'ID of the product',
    example: '60d21b4667d0d8992e610c85',
  })
  @IsMongoId({ message: i18nValidationMessage('validation.IS_MONGO_ID') })
  @Type(() => String)
  productId!: string;

  @ApiProperty({
    description: 'ID of the product variant',
    example: '60d21b4667d0d8992e610c86',
  })
  @IsMongoId({ message: i18nValidationMessage('validation.IS_MONGO_ID') })
  @Type(() => String)
  variantId!: string;

  @ApiProperty({
    description: 'Quantity of the product',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}
