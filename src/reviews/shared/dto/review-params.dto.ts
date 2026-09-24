import { IsMongoId } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class ProductIdParamDto {
  @IsMongoId({ message: i18nValidationMessage('validation.IS_MONGO_ID') })
  productId!: string;
}

// Review ID — ObjectId only (no slug, unlike the generic IdParamDto)
export class ReviewIdParamDto {
  @IsMongoId({ message: i18nValidationMessage('validation.IS_MONGO_ID') })
  id!: string;
}
