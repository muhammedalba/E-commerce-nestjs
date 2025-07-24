import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCartDto {
  @ApiProperty({
    description: 'ID of the product to add to the cart',
    example: '60d21b4667d0d8992e610c85',
  })
  @IsMongoId()
  @Type(() => String)
  productId!: string;

  @ApiProperty({
    description: 'Quantity of the product to add',
    example: 1,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsPositive()
  @Type(() => Number)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Indicates if the cart is checked out',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isCheckedOut: boolean = false;

  @ApiPropertyOptional({
    description: 'Indicates if the cart is saved for later',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isSavedForLater: boolean = false;
}
