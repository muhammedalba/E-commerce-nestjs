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

export class CreateCartDto {
  @IsMongoId()
  @Type(() => String)
  productId!: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsPositive()
  @Type(() => Number)
  quantity!: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isCheckedOut: boolean = false;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isSavedForLater: boolean = false;
}
