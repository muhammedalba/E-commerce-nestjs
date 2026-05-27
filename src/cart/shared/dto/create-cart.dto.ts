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
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';

export class CreateCartDto {
  @IsMongoId()
  @Exists(MODEL_NAMES.PRODUCT)
  @Type(() => String)
  productId!: string;

  @IsMongoId()
  @Exists(MODEL_NAMES.PRODUCT_VARIANT)
  @Type(() => String)
  variantId!: string;

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
