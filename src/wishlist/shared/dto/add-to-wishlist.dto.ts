import { Type } from 'class-transformer';
import { IsMongoId } from 'class-validator';
import { MODEL_NAMES } from 'src/shared/constants/models.constants';
import { Exists } from 'src/shared/utils/decorators/exists.decorator';

export class AddToWishlistDto {
  @IsMongoId()
  @Exists(MODEL_NAMES.PRODUCT)
  @Type(() => String)
  productId!: string;
}
